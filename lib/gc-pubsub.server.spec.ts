import { expect } from 'chai';
import * as sinon from 'sinon';
import { GCPubSubServer } from './gc-pubsub.server';
import { NO_MESSAGE_HANDLER } from '@nestjs/microservices/constants';
import { BaseRpcContext } from '@nestjs/microservices/ctx-host/base-rpc.context';
import { ALREADY_EXISTS } from './gc-pubsub.constants';
import { GCPubSubOptions } from './gc-pubsub.interface';
import { Message } from '@google-cloud/pubsub';
import { Logger } from '@nestjs/common';

describe('GCPubSubServer', () => {
  let server: GCPubSubServer;
  let pubsub: any;
  let topicMock: any;
  let subscriptionMock: any;
  let createClient: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;
  const objectToMap = (obj: any) =>
    new Map(Object.keys(obj).map((key) => [key, obj[key]]) as any);

  const createMockMessage = (data: any, attributes: any = {}): Message => ({
    ackId: 'id',
    // @ts-expect-error - Mock message for testing
    publishTime: new Date(),
    attributes,
    id: 'id',
    received: 0,
    deliveryAttempt: 1,
    ack: () => {},
    modAck: () => {},
    nack: () => {},
    data: Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)),
  });

  const simulateMessageEvent = async (
    server: GCPubSubServer,
    message: Message,
  ) => {
    const onCall = subscriptionMock.on
      .getCalls()
      .find((call: sinon.SinonSpyCall) => call.args[0] === 'message');

    expect(onCall, 'No message handler registered').to.exist;
    const messageHandler = onCall.args[1];
    await messageHandler(message);
  };

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    describe('when the scopedEnvKey is defined', () => {
      it('should set the scopedEnvKey on topics and subscriptions', () => {
        const scopedEnvKey = 'my-key';

        server = getInstance({ scopedEnvKey } as GCPubSubOptions);

        expect(server['topicName']).to.eq(`${scopedEnvKey}default_topic`);
        expect(server['subscriptionName']).to.eq(
          `${scopedEnvKey}default_subscription`,
        );
      });
    });
  });

  describe('listen', () => {
    describe('when is check existence is true', () => {
      beforeEach(async () => {
        server = getInstance({});

        await server.listen(() => {});
      });

      it('should call "createClient"', () => {
        expect(createClient.called).to.be.true;
      });

      it('should call "client.topic" once', async () => {
        expect(pubsub.topic.called).to.be.true;
      });

      it('should call "topic.create" once', async () => {
        expect(topicMock.create.called).to.be.true;
      });

      it('should call "topic.subscription" once', async () => {
        expect(topicMock.subscription.called).to.be.true;
      });

      it('should call "subscription.create" once', async () => {
        expect(subscriptionMock.create.called).to.be.true;
      });

      it('should call "subscription.on" twice', async () => {
        expect(subscriptionMock.on.callCount).to.eq(2);
      });
    });

    describe('when is check existence is false', () => {
      beforeEach(async () => {
        server = getInstance({
          init: false,
          checkExistence: false,
        });

        await server.listen(() => {});
      });

      it('should call "createClient"', () => {
        expect(createClient.called).to.be.true;
      });

      it('should call "client.topic" once', async () => {
        expect(pubsub.topic.called).to.be.true;
      });

      it('should not call "topic.exists" once', async () => {
        expect(topicMock.exists.called).to.be.false;
      });

      it('should call "topic.subscription" once', async () => {
        expect(topicMock.subscription.called).to.be.true;
      });

      it('should not call "subscription.exists" once', async () => {
        expect(subscriptionMock.exists.called).to.be.false;
      });

      it('should call "subscription.on" twice', async () => {
        expect(subscriptionMock.on.callCount).to.eq(2);
      });
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      server = getInstance({});
      await server.listen(() => {});
      await server.close();
    });

    it('should call "subscription.close"', function () {
      expect(subscriptionMock.close.called).to.be.true;
    });

    it('should close() pubsub', () => {
      expect(pubsub.close.called).to.be.true;
    });
  });

  describe('handleMessage', () => {
    const msg = {
      pattern: 'test',
      data: 'tests',
      id: '3',
    };

    beforeEach(async () => {
      server = getInstance({});
      await server.listen(() => {});
    });

    it('should send NO_MESSAGE_HANDLER error if key does not exists in handlers object', async () => {
      await server.handleMessage({
        ackId: 'id',
        // @ts-ignore
        publishTime: new Date(),
        attributes: {
          replyTo: 'replyTo',
        },
        id: 'id',
        received: 0,
        deliveryAttempt: 1,
        ack: () => {},
        modAck: () => {},
        nack: () => {},
        data: Buffer.from(JSON.stringify(msg)),
      });

      expect(
        topicMock.publishMessage.calledWith({
          json: {
            id: msg.id,
            status: 'error',
            err: NO_MESSAGE_HANDLER,
          },
          attributes: {
            id: msg.id,
          },
        }),
      ).to.be.true;
    });

    it('should call handler if exists in handlers object', async () => {
      const handler = sinon.spy();
      (server as any).messageHandlers = objectToMap({
        [msg.pattern]: handler as any,
      });
      await server.handleMessage({
        ackId: 'id',
        // @ts-ignore
        publishTime: new Date(),
        attributes: {},
        id: 'id',
        received: 0,
        deliveryAttempt: 1,
        ack: () => {},
        modAck: () => {},
        nack: () => {},
        data: Buffer.from(JSON.stringify(msg)),
      });
      expect(handler.calledOnce).to.be.true;
    });

    it('should return undefined when data is not in JSON format', async () => {
      const result = await server.handleMessage({
        ackId: 'id',
        // @ts-ignore
        publishTime: new Date(),
        attributes: {},
        id: 'id',
        received: 0,
        deliveryAttempt: 1,
        ack: () => {},
        modAck: () => {},
        nack: () => {},
        data: Buffer.from('text'),
      });
      expect(result).to.be.undefined;
    });
  });

  describe('message acknowledgment behavior', () => {
    const msg = {
      pattern: 'test',
      data: 'tests',
      id: '3',
    };

    it('should auto acknowledge message when noAck is true and message handling succeeded', async () => {
      server = getInstance({ noAck: true });
      await server.listen(() => {});

      const message = createMockMessage(msg);
      const ackSpy = sinon.spy(message, 'ack');

      await simulateMessageEvent(server, message);

      expect(ackSpy.calledOnce).to.be.true;
    });

    it('should auto negative acknowledge message when noAck is true and message handling failed', async () => {
      server = getInstance({ noAck: true });
      await server.listen(() => {});

      const message = createMockMessage(msg);
      const nackSpy = sinon.spy(message, 'nack');

      (server as any).messageHandlers = objectToMap({
        [msg.pattern]: sinon.stub().rejects(new Error('Handler failed')),
      });

      await simulateMessageEvent(server, message);

      expect(nackSpy.calledOnce).to.be.true;
    });

    it('should not auto acknowledge message when noAck is false and message handling succeeded', async () => {
      server = getInstance({ noAck: false });
      await server.listen(() => {});

      const message = createMockMessage(msg);
      const ackSpy = sinon.spy(message, 'ack');

      await simulateMessageEvent(server, message);

      expect(ackSpy.called).to.be.false;
    });

    it('should not auto negative acknowledge message when noAck is false and message handling failed', async () => {
      server = getInstance({ noAck: false });
      await server.listen(() => {});

      const message = createMockMessage(msg);
      const nackSpy = sinon.spy(message, 'nack');

      (server as any).messageHandlers = objectToMap({
        [msg.pattern]: sinon.stub().rejects(new Error('Handler failed')),
      });

      await simulateMessageEvent(server, message);

      expect(nackSpy.called).to.be.false;
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      server = getInstance({});
      await server.listen(() => {});
    });

    it('should publish message to indicated topic', async () => {
      const message = { test: true };
      const replyTo = 'test';
      const correlationId = '0';

      await server.sendMessage(message, replyTo, correlationId);
      expect(
        topicMock.publishMessage.calledWith({
          json: { ...message, id: correlationId },
          attributes: {
            id: correlationId,
          },
        }),
      ).to.be.true;
    });

    describe('when scopedEnvKey is defined', () => {
      beforeEach(async () => {
        server = getInstance({ scopedEnvKey: 'my-key' });
        await server.listen(() => {});
      });

      it('should set scopedEnvKey on replyTo', async () => {
        const message = { test: true };
        const replyTo = 'test';
        const correlationId = '0';

        await server.sendMessage(message, replyTo, correlationId);
        expect(Array.from(server['replyTopics'].values())).to.deep.eq(['test']);
      });
    });
  });

  describe('handleEvent', () => {
    const channel = 'test';
    const data = 'test';

    beforeEach(async () => {
      server = getInstance({});
    });

    it('should call handler with expected arguments', () => {
      const handler = sandbox.spy();
      (server as any).messageHandlers = objectToMap({
        [channel]: handler,
      });

      server.handleEvent(
        channel,
        { pattern: '', data },
        new BaseRpcContext([]),
      );
      expect(handler.calledWith(data)).to.be.true;
    });
  });

  describe('createIfNotExists', () => {
    it('should throw error', async () => {
      const create = sandbox.stub().rejects({ code: 7 });
      try {
        await server['createIfNotExists'](create);
      } catch (error) {
        expect(error).to.include({ code: 7 });
      }
      expect(create.called).to.be.true;
    });
    it('should skip error', async () => {
      const create = sandbox.stub().rejects({ code: ALREADY_EXISTS });
      await server['createIfNotExists'](create);
      expect(create.called).to.be.true;
    });
  });

  function getInstance(options: GCPubSubOptions): GCPubSubServer {
    const server = new GCPubSubServer(options);

    sandbox = sinon.createSandbox();

    const logger = new Logger();
    sinon.stub(logger, 'error');

    server['logger'] = logger;

    subscriptionMock = {
      create: sandbox.stub().resolves(),
      close: sandbox.stub().callsFake((callback) => callback()),
      on: sandbox.stub().returnsThis(),
      exists: sandbox.stub().resolves([true]),
    };

    topicMock = {
      create: sandbox.stub().resolves(),
      exists: sandbox.stub().resolves([true]),
      flush: sandbox.stub().callsFake((callback) => callback()),
      publishMessage: sandbox.stub().resolves(),
      subscription: sandbox.stub().returns(subscriptionMock),
    };

    pubsub = {
      topic: sandbox.stub().returns(topicMock),
      close: sandbox.stub().callsFake((callback) => callback()),
    };

    createClient = sandbox.stub(server, 'createClient').returns(pubsub);

    return server;
  }
});

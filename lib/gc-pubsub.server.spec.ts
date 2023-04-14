import { expect } from 'chai';
import * as sinon from 'sinon';
import { GCPubSubServer } from './gc-pubsub.server';
import { NO_MESSAGE_HANDLER } from '@nestjs/microservices/constants';
import { BaseRpcContext } from '@nestjs/microservices/ctx-host/base-rpc.context';
import { ALREADY_EXISTS } from './gc-pubsub.constants';
import { GCPubSubOptions } from './gc-pubsub.interface';

describe('GCPubSubServer', () => {
  let server: GCPubSubServer;
  let pubsub: any;
  let topicMock: any;
  let subscriptionMock: any;
  let createClient: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;
  const objectToMap = (obj: any) =>
    new Map(Object.keys(obj).map((key) => [key, obj[key]]) as any);

  afterEach(() => {
    sandbox.restore();
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
        attributes: {},
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

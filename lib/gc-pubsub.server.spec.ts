/* eslint-disable @typescript-eslint/no-empty-function */
import { expect } from 'chai';
import * as sinon from 'sinon';
import { GCPubSubServer } from './gc-pubsub.server';
import { NO_MESSAGE_HANDLER } from '@nestjs/microservices/constants';
import { BaseRpcContext } from '@nestjs/microservices/ctx-host/base-rpc.context';
import { ALREADY_EXISTS } from './gc-pubsub.constants';
import { GCPubSubServerOptions } from './gc-pubsub.interface';
import { CreateSubscriptionOptions, Message } from '@google-cloud/pubsub';
import Sinon = require('sinon');

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

    describe('when createSubscriptionOptions is provided', () => {
      const mockCreateSubscriptionOptions: CreateSubscriptionOptions = {
        messageRetentionDuration: {
          seconds: 604800, // 7 days
        },
        pushEndpoint: 'https://example.com/push',
        oidcToken: {
          serviceAccountEmail: 'example@example.com',
          audience: 'https://example.com',
        },
        topic: 'projects/my-project/topics/my-topic',
        pushConfig: {
          pushEndpoint: 'https://example.com/push',
        },
        ackDeadlineSeconds: 60,
        retainAckedMessages: true,
        labels: {
          env: 'dev',
          version: '1.0.0',
        },
        enableMessageOrdering: false,
        expirationPolicy: {
          ttl: {
            seconds: 86400, // 1 day
          },
        },
        filter: 'attribute.type = "order"',
        deadLetterPolicy: {
          deadLetterTopic: 'projects/my-project/topics/my-dead-letter-topic',
          maxDeliveryAttempts: 5,
        },
        retryPolicy: {
          minimumBackoff: {
            seconds: 10,
          },
          maximumBackoff: {
            seconds: 300,
          },
        },
        detached: false,
        enableExactlyOnceDelivery: true,
        topicMessageRetentionDuration: {
          seconds: 2592000, // 30 days
        },
        state: 'ACTIVE',
      };

      beforeEach(async () => {
        server = getInstance({
          createSubscriptionOptions: mockCreateSubscriptionOptions,
        });
        await server.listen(() => {});
      });
      it('should call "subscription.create" with argument', async () => {
        // Verify that subscription.create() was called with the correct arguments
        expect(subscriptionMock.create.calledOnce).to.be.true;
        expect(
          subscriptionMock.create.calledWith(mockCreateSubscriptionOptions),
        ).to.be.true;
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
      data: 'tests',
    };

    const messageOptions: Message = {
      ackId: 'id',
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      publishTime: new Date(),
      attributes: {
        _replyTo: 'replyTo',
        _id: '3',
        _pattern: 'test',
        _clientId: '4',
      },
      id: 'id',
      received: 0,
      deliveryAttempt: 1,
      ack: () => {},
      modAck: () => {},
      nack: () => {},
      data: Buffer.from(JSON.stringify(msg)),
    };

    beforeEach(async () => {
      server = getInstance({});
      await server.listen(() => {});
    });

    it('should send NO_MESSAGE_HANDLER error if key does not exists in handlers object', async () => {
      await server.handleMessage(messageOptions);

      expect(
        topicMock.publishMessage.calledWith({
          data: Buffer.from(
            JSON.stringify({
              id: messageOptions.attributes._id,
              status: 'error',
              err: NO_MESSAGE_HANDLER,
            }),
          ),
          attributes: {
            id: messageOptions.attributes._id,
            ...messageOptions.attributes,
          },
        }),
      ).to.be.true;
    });

    it('should send TIMEOUT_ERROR_HANDLER if the message is timed out', async () => {
      server = getInstance({ noAck: false });
      await server.listen(() => {});
      const timeoutMessageOptions: Message = {
        ackId: 'id',
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        publishTime: new Date(Date.now() - 5000),
        attributes: {
          _replyTo: 'replyTo',
          _id: '3',
          _pattern: 'test',
          _clientId: '4',
          _timeout: '4000',
        },
        id: 'id',
        received: 0,
        deliveryAttempt: 1,
        ack: sinon.stub(),
        modAck: () => {},
        nack: () => {},
        data: Buffer.from(JSON.stringify(msg)),
      };
      await server.handleMessage(timeoutMessageOptions);

      expect(
        topicMock.publishMessage.calledWith({
          data: Buffer.from(
            JSON.stringify({
              id: timeoutMessageOptions.attributes._id,
              status: 'error',
              err: 'Message Timeout',
            }),
          ),
          attributes: {
            id: timeoutMessageOptions.attributes._id,
            ...timeoutMessageOptions.attributes,
          },
        }),
      ).to.be.true;
      expect((timeoutMessageOptions.ack as Sinon.SinonStub).calledOnce).to.be
        .true;
    });

    it('should call handler if exists in handlers object', async () => {
      const handler = sinon.spy();
      (server as any).messageHandlers = objectToMap({
        [messageOptions.attributes._pattern]: handler as any,
      });
      await server.handleMessage(messageOptions);
      expect(handler.calledOnce).to.be.true;
    });

    it('should ack after response if ackAfterResponse is true', async () => {
      server = getInstance({ ackAfterResponse: true });
      await server.listen(() => {});
      await server.close();
      const handler = sinon.spy();
      (server as any).messageHandlers = objectToMap({
        [messageOptions.attributes._pattern]: handler as any,
      });
      await server.handleMessage(messageOptions);
      expect(handler.calledOnce).to.be.true;
      expect((messageOptions.ack as Sinon.SinonStub).calledOnce);
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
          data: Buffer.from(JSON.stringify({ ...message, id: correlationId })),
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

  function getInstance(
    options: Partial<GCPubSubServerOptions>,
  ): GCPubSubServer {
    const server = new GCPubSubServer(options as GCPubSubServerOptions);

    sandbox = sinon.createSandbox();

    subscriptionMock = {
      create: sandbox.stub().resolves(),
      close: sandbox.stub().callsFake((callback) => callback()),
      on: sandbox.stub().returnsThis(),
      exists: sandbox.stub().resolves([true]),
      delete: sandbox.stub().resolves(),
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

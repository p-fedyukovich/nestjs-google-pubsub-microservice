import { expect } from 'chai';
import * as sinon from 'sinon';
import { ALREADY_EXISTS } from './gc-pubsub.constants';
import { GCPubSubClient } from './gc-pubsub.client';
import { GCPubSubClientOptions } from './gc-pubsub.interface';
import { GCPubSubMessageBuilder } from './gc-message.builder';
import { CreateSubscriptionOptions } from '@google-cloud/pubsub';

describe('GCPubSubClient', () => {
  let client: GCPubSubClient;
  let pubsub: any;
  let topicMock: any;
  let subscriptionMock: any;
  let createClient: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;

  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('connect', () => {
    describe('when is not connected', () => {
      describe('when check existence is true', () => {
        beforeEach(async () => {
          client = getInstance({
            replyTopic: 'replyTopic',
            replySubscription: 'replySubcription',
          });
          try {
            client['client'] = null;
            await client.connect();
          } catch {}
        });

        it('should call "createClient" once', async () => {
          expect(createClient.called).to.be.true;
        });

        it('should call "client.topic" once', async () => {
          expect(pubsub.topic.called).to.be.true;
        });

        it('should call "topic.exists" once', async () => {
          expect(topicMock.exists.called).to.be.true;
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
          client = getInstance({
            createSubscriptionOptions: mockCreateSubscriptionOptions,
            replySubscription: 'testSubscription',
            replyTopic: 'testTopic',
            checkExistence: true,
            init: true,
          });
          await client.connect();
        });
        it('should call "subscription.create" with argument', async () => {
          // Verify that subscription.create() was called with the correct arguments
          expect(subscriptionMock.create.calledOnce).to.be.true;
          expect(
            subscriptionMock.create.calledWith(mockCreateSubscriptionOptions),
          ).to.be.true;
        });
      });

      describe('when clientIdFilter is turned on', () => {
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
          client = getInstance({
            createSubscriptionOptions: mockCreateSubscriptionOptions,
            replySubscription: 'testSubscription',
            replyTopic: 'testTopic',
            checkExistence: true,
            init: true,
            clientIdFilter: true,
          });
          await client.connect();
        });
        it('should call subscription.create with client id filter', async () => {
          // Verify that subscription.create() was called with the correct arguments
          const expectedArgs: CreateSubscriptionOptions = {
            ...mockCreateSubscriptionOptions,
            filter: `attributes._clientId = "${client.clientId}" AND (${mockCreateSubscriptionOptions.filter})`,
          };
          expect(subscriptionMock.create.calledOnce).to.be.true;
          expect(subscriptionMock.create.calledWith(expectedArgs)).to.be.true;
        });

        it('should call subscription.create with client id filter with empty filter', async () => {
          // Verify that subscription.create() was called with the correct arguments
          client = getInstance({
            replySubscription: 'testSubscription',
            replyTopic: 'testTopic',
            checkExistence: true,
            init: true,
            clientIdFilter: true,
          });
          await client.connect();
          const expectedArgs: CreateSubscriptionOptions = {
            filter: `attributes._clientId = "${client.clientId}"`,
          };
          expect(subscriptionMock.create.calledOnce).to.be.true;
          expect(subscriptionMock.create.calledWith(expectedArgs)).to.be.true;
        });

        it('should call not subscription.create with client id when clientIdFilter is off', async () => {
          // Verify that subscription.create() was called with the correct arguments
          client = getInstance({
            replySubscription: 'testSubscription',
            replyTopic: 'testTopic',
            checkExistence: true,
            init: true,
          });
          await client.connect();
          expect(subscriptionMock.create.calledOnce).to.be.true;
          expect(subscriptionMock.create.calledWith()).to.be.true;
        });
      });

      describe('when check existence is false', () => {
        beforeEach(async () => {
          client = getInstance({
            replyTopic: 'replyTopic',
            replySubscription: 'replySubscription',
            init: false,
            checkExistence: false,
          });

          try {
            client['client'] = null;
            await client.connect();
          } catch {}
        });

        it('should call "createClient" once', () => {
          expect(createClient.called).to.be.true;
        });

        it('should call "client.topic" once', () => {
          expect(pubsub.topic.called).to.be.true;
        });

        it('should not call "topic.exists" once', () => {
          expect(topicMock.exists.called).to.be.false;
        });

        it('should not call "topic.create" once', () => {
          expect(topicMock.create.called).to.be.false;
        });

        it('should call "topic.subscription" once', () => {
          expect(topicMock.subscription.called).to.be.true;
        });

        it('should not call "subscription.exists" once', () => {
          expect(subscriptionMock.exists.called).to.be.false;
        });

        it('should call "subscription.on" twice', () => {
          expect(subscriptionMock.on.callCount).to.eq(2);
        });
      });
    });

    describe('when is connected', () => {
      beforeEach(async () => {
        client = getInstance({
          replyTopic: 'replyTopic',
          replySubscription: 'replySubscription',
          appendClientIdToSubscription: true,
        });

        try {
          client['client'] = pubsub;
          await client.connect();
        } catch {}
      });

      it('should not call "createClient"', async () => {
        expect(createClient.called).to.be.false;
      });

      it('should not call "client.topic"', async () => {
        expect(pubsub.topic.called).to.be.false;
      });

      it('should not call "topic.create"', async () => {
        expect(topicMock.create.called).to.be.false;
      });

      it('should not call "topic.subscription"', async () => {
        expect(topicMock.subscription.called).to.be.false;
      });

      it('should not call "subscription.create"', async () => {
        expect(subscriptionMock.create.called).to.be.false;
      });

      it('should not call "subscription.on"', async () => {
        expect(subscriptionMock.on.callCount).to.eq(0);
      });
      describe('when appendClientIdToSubcription is true', () => {
        it('should appeand clientId to subscription name', () => {
          expect(client['replySubscriptionName']).to.equal(
            `replySubscription-${client.clientId}`,
          );
        });
      });
    });
  });

  describe('publish', () => {
    let callback: sinon.SinonSpy;
    beforeEach(() => {
      callback = sandbox.spy();
      client = getInstance({
        replyTopic: 'replyTopic',
        replySubscription: 'replySubcription',
        autoResume: true,
      });
      (client as any).topic = topicMock;
      topicMock.publishMessage = sinon.stub().resolves();
    });
    const pattern = 'test';
    const msg = { pattern, data: 'data' };
    it('should send message to a proper topic', () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      client['publish'](msg, () => {});
      const message = topicMock.publishMessage.getCall(0).args[0];
      expect(topicMock.publishMessage.called).to.be.true;
      expect(message.json).to.be.eql(msg.data);
    });

    it('should remove listener from routing map on dispose', () => {
      client['publish'](msg, () => ({}))();

      expect(client['routingMap'].size).to.be.eq(0);
    });

    it('should call callback on error', () => {
      const callback = sandbox.spy();
      sinon.stub(client, 'assignPacketId' as any).callsFake(() => {
        throw new Error();
      });
      client['publish'](msg, callback);
      expect(callback.called).to.be.true;
      expect(callback.getCall(0).args[0].err).to.be.instanceof(Error);
    });

    it('should call resumePublishing on error with ordering key', (done) => {
      topicMock.publishMessage = sinon.stub().rejects();
      const message = {
        data: new GCPubSubMessageBuilder('data').setOrderingKey('asdf').build(),
        pattern: 'test',
      };
      client['publish'](message, () => {
        expect(topicMock.resumePublishing.called).to.be.true;
        done();
      });
    });

    it('should send message to a proper topic', () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      client['publish'](msg, (): any => {});

      expect(topicMock.publishMessage.called).to.be.true;
      const message = topicMock.publishMessage.getCall(0).args[0];
      expect(message.json).to.be.eql(msg.data);
      expect(message.attributes._pattern).to.be.eql(JSON.stringify(pattern));
      expect(message.attributes._id).to.be.not.empty;
    });

    it('should setTimeout to call callback with timeout error when timeout is provided', () => {
      // TODO: implement test
      const message = {
        data: new GCPubSubMessageBuilder('data')
          .setOrderingKey('asdf')
          .setTimeout(500)
          .build(),
        pattern: 'test',
      };

      client['publish'](message, callback);
      clock.tick(510);
      expect(callback.calledOnce).to.be.true;
    });
  });

  describe('handleResponse', () => {
    let callback: any;
    const id = '1';

    beforeEach(() => {
      callback = sandbox.spy();
    });

    describe('when disposed', () => {
      beforeEach(() => {
        client['routingMap'].set(id, callback);
        client.handleResponse({
          data: Buffer.from(JSON.stringify({ id, isDisposed: true })),
          attributes: {},
        });
      });

      it('should emit disposed callback', () => {
        expect(callback.called).to.be.true;
        expect(
          callback.calledWith({
            err: undefined,
            response: undefined,
            isDisposed: true,
          }),
        ).to.be.true;
      });
    });

    describe('when not disposed', () => {
      let buffer: any;

      beforeEach(() => {
        buffer = { id, err: undefined, response: 'res' };
        client['routingMap'].set(id, callback);
        client.handleResponse({
          data: Buffer.from(JSON.stringify(buffer)),
          attributes: {},
        });
      });

      it('should not close server', () => {
        expect(pubsub.close.called).to.be.false;
      });

      it('should call callback with error and response data', () => {
        expect(callback.called).to.be.true;
        expect(
          callback.calledWith({
            err: buffer.err,
            response: buffer.response,
          }),
        ).to.be.true;
      });
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      client = getInstance({
        replyTopic: 'replyTopic',
        replySubscription: 'replySubcription',
      });
      await client.connect();
      await client.close();
    });

    it('should call "replySubscription.close"', function () {
      expect(subscriptionMock.close.called).to.be.true;
    });

    it('should close() pubsub', () => {
      expect(pubsub.close.called).to.be.true;
    });

    it('should set "client" to null', () => {
      expect((client as any).client).to.be.null;
    });

    it('should set "topic" to null', () => {
      expect((client as any).topic).to.be.null;
    });

    it('should set "replySubscription" to null', () => {
      expect((client as any).replySubscription).to.be.null;
    });

    describe('autoDeleteSubscriptionOnClose is true', () => {
      beforeEach(async () => {
        client = getInstance({
          autoDeleteSubscriptionOnShutdown: true,
          replyTopic: 'replyTopic',
          replySubscription: 'replySubcription',
        });
        await client.connect();
        await client.close();
      });
      it('should delete subscription on close', () => {
        expect(subscriptionMock.delete.calledOnce).to.be.true;
      });
    });
  });

  describe('dispatchEvent', () => {
    const msg = { pattern: 'pattern', data: 'data' };

    beforeEach(() => {
      client = getInstance({
        replyTopic: 'replyTopic',
        replySubscription: 'replySubcription',
      });
      (client as any).topic = topicMock;
    });

    it('should publish packet', async () => {
      await client['dispatchEvent'](msg);
      expect(topicMock.publishMessage.called).to.be.true;
    });

    it('should publish packet with proper data', async () => {
      await client['dispatchEvent'](msg);
      expect(topicMock.publishMessage.getCall(0).args[0].json).to.be.eql(
        msg.data,
      );
    });

    it('should throw error', async () => {
      topicMock.publishMessage.callsFake((a: any, b: any, c: any, d: any) =>
        d(new Error()),
      );
      client['dispatchEvent'](msg).catch((err) =>
        expect(err).to.be.instanceOf(Error),
      );
    });

    it('should publish packet', async () => {
      await client['dispatchEvent'](msg);
      expect(topicMock.publishMessage.called).to.be.true;
    });

    it('should publish packet with proper data', async () => {
      await client['dispatchEvent'](msg);
      const message = topicMock.publishMessage.getCall(0).args[0];
      expect(message.json).to.be.eql(msg.data);
      expect(message.attributes._pattern).to.be.eql(msg.pattern);
    });

    it('should throw error', async () => {
      topicMock.publishMessage.callsFake((a: any, b: any, c: any, d: any) =>
        d(new Error()),
      );
      client['dispatchEvent'](msg).catch((err) =>
        expect(err).to.be.instanceOf(Error),
      );
    });
  });

  describe('createIfNotExists', () => {
    it('should throw error', async () => {
      const create = sandbox.stub().rejects({ code: 7 });
      try {
        await client['createIfNotExists'](create);
      } catch (error) {
        expect(error).to.include({ code: 7 });
      }
      expect(create.called).to.be.true;
    });

    it('should skip error', async () => {
      const create = sandbox.stub().rejects({ code: ALREADY_EXISTS });
      await client['createIfNotExists'](create);
      expect(create.called).to.be.true;
    });
  });

  function getInstance(options: GCPubSubClientOptions): GCPubSubClient {
    const client = new GCPubSubClient(options);

    // Override client ID for testing purpose
    // Object.assign(client, { clientId: '123' });

    subscriptionMock = {
      create: sandbox.stub().resolves(),
      close: sandbox.stub().callsFake((callback) => callback()),
      on: sandbox.stub().returnsThis(),
      exists: sandbox.stub().resolves([true]),
      delete: sandbox.stub().resolves(),
    };

    topicMock = {
      create: sandbox.stub().resolves(),
      flush: sandbox.stub().callsFake((callback) => callback()),
      publishMessage: sandbox.stub().resolves(),
      exists: sandbox.stub().resolves([true]),
      subscription: sandbox.stub().returns(subscriptionMock),
      resumePublishing: sinon.stub().resolves(),
    };

    pubsub = {
      topic: sandbox.stub().callsFake(() => topicMock),
      close: sandbox.stub().callsFake((callback) => callback()),
    };

    createClient = sandbox.stub(client, 'createClient').callsFake(() => pubsub);
    return client;
  }
});

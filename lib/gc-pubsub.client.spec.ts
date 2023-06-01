import { expect } from 'chai';
import * as sinon from 'sinon';
import { ALREADY_EXISTS } from './gc-pubsub.constants';
import { GCPubSubClient } from './gc-pubsub.client';
import { GCPubSubOptions } from './gc-pubsub.interface';

describe('GCPubSubClient', () => {
  let client: GCPubSubClient;
  let pubsub: any;
  let topicMock: any;
  let subscriptionMock: any;
  let createClient: sinon.SinonStub;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('constructor', () => {
    describe('when the scopedEnvKey is defined', () => {
      beforeEach(() => {
        client = getInstance({
          topic: 'topic',
          replyTopic: 'replyTopic',
          replySubscription: 'replySubscription',
          scopedEnvKey: 'my-key',
        });
      });

      it('should set the scopedEnvKey on topics and subscriptions', () => {
        expect(client['topicName']).to.be.eq('my-keytopic');
        expect(client['replyTopicName']).to.be.eq('my-keyreplyTopic');
        expect(client['replySubscriptionName']).to.be.eq(
          'my-keyreplySubscription',
        );
      });
    });
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
          replySubscription: 'replySubcription',
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
    });
  });

  describe('publish', () => {
    describe('useAttributes=false', () => {
      const pattern = 'test';
      const msg = { pattern, data: 'data' };

      beforeEach(() => {
        client = getInstance({
          replyTopic: 'replyTopic',
          replySubscription: 'replySubcription',
        });

        (client as any).topic = topicMock;
      });

      it('should send message to a proper topic', () => {
        client['publish'](msg, () => {
          expect(topicMock.publishMessage.called).to.be.true;
          expect(topicMock.publishMessage.getCall(0).args[0].json).to.be.eql(
            msg,
          );
        });
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
    });

    describe('useAttributes=true', () => {
      const pattern = 'test';
      const msg = { pattern, data: 'data' };

      beforeEach(() => {
        client = getInstance({
          replyTopic: 'replyTopic',
          replySubscription: 'replySubcription',
          useAttributes: true,
        });

        (client as any).topic = topicMock;
      });

      it('should send message to a proper topic', () => {
        client['publish'](msg, () => {});

        expect(topicMock.publishMessage.called).to.be.true;
        const message = topicMock.publishMessage.getCall(0).args[0];
        expect(message.json).to.be.eql(msg.data);
        expect(message.attributes.pattern).to.be.eql(pattern);
        expect(message.attributes.id).to.be.not.empty;
      });
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
  });

  describe('dispatchEvent', () => {
    describe('useAttributes=false', () => {
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
        expect(topicMock.publishMessage.getCall(0).args[0].json).to.be.eql(msg);
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

    describe('useAttributes=true', () => {
      const msg = { pattern: 'pattern', data: 'data' };

      beforeEach(() => {
        client = getInstance({
          replyTopic: 'replyTopic',
          replySubscription: 'replySubcription',
          useAttributes: true,
        });
        (client as any).topic = topicMock;
      });

      it('should publish packet', async () => {
        await client['dispatchEvent'](msg);
        expect(topicMock.publishMessage.called).to.be.true;
      });

      it('should publish packet with proper data', async () => {
        await client['dispatchEvent'](msg);
        const message = topicMock.publishMessage.getCall(0).args[0];
        expect(message.json).to.be.eql(msg.data);
        expect(message.attributes.pattern).to.be.eql(msg.pattern);
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

  function getInstance(options: GCPubSubOptions): GCPubSubClient {
    const client = new GCPubSubClient(options);

    subscriptionMock = {
      create: sandbox.stub().resolves(),
      close: sandbox.stub().callsFake((callback) => callback()),
      on: sandbox.stub().returnsThis(),
      exists: sandbox.stub().resolves([true]),
    };

    topicMock = {
      create: sandbox.stub().resolves(),
      flush: sandbox.stub().callsFake((callback) => callback()),
      publishMessage: sandbox.stub().resolves(),
      exists: sandbox.stub().resolves([true]),
      subscription: sandbox.stub().returns(subscriptionMock),
    };

    pubsub = {
      topic: sandbox.stub().callsFake(() => topicMock),
      close: sandbox.stub().callsFake((callback) => callback()),
    };

    createClient = sandbox.stub(client, 'createClient').callsFake(() => pubsub);

    return client;
  }
});

import { INestApplication } from '@nestjs/common';
import {
  GCPubSubClient,
  GCPubSubClientModule,
  GCPubSubServer,
  getGCPubSubClientToken,
} from '../../lib';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { GCPubSubTestModule } from '../src/gc-pubsub-test.module';
import { ERROR_EVENT } from '@nestjs/microservices/constants';

const Emulator = require('google-pubsub-emulator');
describe('GCPubSub with Message Builder', () => {
  let server;
  let app: INestApplication;

  const projectId = 'test-project-id';
  const emulatorPort = 8086;
  const emulatorEndpoint = `localhost`;
  let emulator;

  beforeAll(() => {
    emulator = new Emulator({
      project: projectId,
      host: emulatorEndpoint,
      port: emulatorPort,
      deubg: true,
      topics: ['broadcast3'],
    });

    emulator.start();
  });

  afterAll(() => {
    return emulator.stop();
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [GCPubSubTestModule],
    }).compile();

    app = module.createNestApplication();
    server = app.getHttpAdapter().getInstance();

    app.connectMicroservice({
      strategy: new GCPubSubServer({
        topic: 'broadcast',
        subscription: 'test-sub',
        client: {
          apiEndpoint: 'localhost:8086',
          projectId: 'test-project-id',
        },
        init: true,
      }),
    });

    app.connectMicroservice({
      strategy: new GCPubSubServer({
        topic: 'broadcast2',
        subscription: 'test-sub',
        client: {
          apiEndpoint: 'localhost:8086',
          projectId: 'test-project-id',
        },
        init: true,
      }),
    });

    await app.startAllMicroservices();
    await app.init();
  });

  it('should return the data', async () => {
    const response = await request(server).get('/data').expect(200, 'Hello');
  });

  it('should return the attributes', async () => {
    const response = await request(server).get('/attributes').expect(200);
    expect(response.body.attrs).toEqual('attrs');
    expect(response.body.test).toEqual('test');
  });

  it('should return the ordering key', async () => {
    const response = await request(server)
      .get('/ordering-key')
      .expect(200, 'test1');
  });

  describe('Multiple Clients', () => {
    it('should send and receive datafrom client one but not from client two', async () => {
      const response = await request(server).get('/multiple-client-test');
      const responseAgain = await request(server).get('/multiple-client-test');

      expect(response.body.incomingClientId).toEqual(response.body.clientOneId);
      expect(response.body.incomingClientId).not.toEqual(
        response.body.clientTwoId,
      );
    });
  });

  describe('Timeout', () => {
    it('should timeout the request and send a timeout response', async () => {
      const response = await request(server).get('/timeout').expect(408);
    });
  });

  describe('Delete Subscription on Shutdown', () => {
    let deleteSubscriptionApp: INestApplication;
    let deleteSubscriptionValidationApp: INestApplication;
    beforeEach(async () => {
      const module = await Test.createTestingModule({
        imports: [
          GCPubSubClientModule.register([
            {
              name: 'client3',
              config: {
                topic: 'broadcast3',
                subscription: 'test-sub',
                replyTopic: 'test_reply',
                replySubscription: 'test_reply-sub',
                client: {
                  apiEndpoint: 'localhost:8086',
                  projectId: 'test-project-id',
                },
                init: true,
                autoDeleteSubscriptionOnShutdown: true,
              },
            },
          ]),
        ],
      }).compile();

      deleteSubscriptionApp = module.createNestApplication();
      deleteSubscriptionApp.connectMicroservice({
        strategy: new GCPubSubServer({
          topic: 'broadcast3',
          subscription: 'test-sub',
          replyTopic: 'test_reply',
          replySubscription: 'test_reply-sub',
          client: {
            apiEndpoint: 'localhost:8086',
            projectId: 'test-project-id',
          },
          init: true,
          autoDeleteSubscriptionOnShutdown: true,
        }),
      });
      await deleteSubscriptionApp.startAllMicroservices();
      await deleteSubscriptionApp.init();
    });
    it('should delete subscription on shutdown', async () => {
      await deleteSubscriptionApp.close();

      const module = await Test.createTestingModule({
        imports: [
          GCPubSubClientModule.register([
            {
              name: 'client3',
              config: {
                topic: 'broadcast3',
                subscription: 'test-sub',
                replyTopic: 'test_reply',
                replySubscription: 'test_reply-sub',
                client: {
                  apiEndpoint: 'localhost:8086',
                  projectId: 'test-project-id',
                },
              },
            },
          ]),
        ],
      }).compile();

      deleteSubscriptionValidationApp = module.createNestApplication();

      const client = deleteSubscriptionValidationApp.get(
        getGCPubSubClientToken('client3'),
      ) as GCPubSubServer;

      const pubsub = client.createClient();
      const [subscriptions] = await pubsub.getSubscriptions();
      expect(subscriptions.find((sub) => sub.name === 'test-sub'))
        .toBeUndefined;
      await pubsub.close();
    });
    afterEach(async () => {
      if (deleteSubscriptionApp) await deleteSubscriptionApp.close();
      if (deleteSubscriptionValidationApp)
        await deleteSubscriptionValidationApp.close();
    });
  });
});

import { GCPubSubServer } from '../../lib';
import { INestApplication } from '@nestjs/common';
import { GCPubSubBroadcastController } from '../src/gc-pubsub-broadcast.controller';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
const Emulator = require('google-pubsub-emulator');
describe('GC PubSub transport', () => {
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
    });
    return emulator.start();
  });

  afterAll(() => {
    return emulator.stop();
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [GCPubSubBroadcastController],
    }).compile();

    app = module.createNestApplication();
    server = app.getHttpAdapter().getInstance();

    app.connectMicroservice({
      strategy: new GCPubSubServer({
        topic: 'broadcast',
        subscription: 'broadcast_subscription_1',
        client: {
          apiEndpoint: 'localhost:8086',
          projectId: 'test-project-id',
        },
        init: true,
      }),
    });
    app.connectMicroservice({
      strategy: new GCPubSubServer({
        topic: 'broadcast',
        subscription: 'broadcast_subscription_2',
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

  it(`Broadcast (2 subscribers)`, () => {
    return request(server).get('/broadcast').expect(200, '2');
  });

  afterEach(async () => {
    await app.close();
  });
});

import { GCPubSubServer } from '../../lib/gc-pubsub.server';
import { INestApplication } from '@nestjs/common';
import { GCPubSubBroadcastController } from '../src/gc-pubsub-broadcast.controller';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

describe('GC PubSub transport', () => {
  let server;
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [GCPubSubBroadcastController],
    }).compile();

    app = module.createNestApplication();
    server = app.getHttpAdapter().getInstance();

    app.connectMicroservice({
      strategy: new GCPubSubServer({
        client: {
          apiEndpoint: 'localhost:8681',
          projectId: 'microservice',
        },
      }),
    });
    app.connectMicroservice({
      strategy: new GCPubSubServer({
        subscription: 'default_subscription2',
        client: {
          apiEndpoint: 'localhost:8681',
          projectId: 'microservice',
        },
      }),
    });
    await app.startAllMicroservicesAsync();
    await app.init();
  });

  it(`Broadcast (2 subscribers)`, () => {
    return request(server).get('/broadcast').expect(200, '2');
  });

  afterEach(async () => {
    await app.close();
  });
});

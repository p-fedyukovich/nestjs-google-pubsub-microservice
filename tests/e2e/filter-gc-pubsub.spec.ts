import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PubSub } from '@google-cloud/pubsub';
import { expect } from 'chai';
import * as request from 'supertest';
import { GCPubSubServer } from '../../lib';
import { GCPubSubFilterController } from '../src/gc-pubsub-filter.controller';

const CLIENT_CONFIG = {
  apiEndpoint: 'localhost:8681',
  projectId: 'microservice',
};

const FILTER = 'attributes.pattern = "matched_event"';

describe('GC PubSub transport: subscription filter', () => {
  let server;
  let app: INestApplication;

  beforeEach(async () => {
    GCPubSubFilterController.MATCHED_RECEIVED = false;

    const module = await Test.createTestingModule({
      controllers: [GCPubSubFilterController],
    }).compile();

    app = module.createNestApplication();
    server = app.getHttpAdapter().getInstance();

    app.connectMicroservice({
      strategy: new GCPubSubServer({
        client: CLIENT_CONFIG,
        topic: 'filter_test_topic',
        subscription: 'filter_test_subscription',
        subscriptionFilter: FILTER,
        useAttributes: true,
      }),
    });

    await app.startAllMicroservices();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should receive messages whose attributes match the filter', (done) => {
    request(server)
      .post('/emit-matched')
      .end(() => {
        setTimeout(() => {
          expect(GCPubSubFilterController.MATCHED_RECEIVED).to.be.true;
          done();
        }, 1000);
      });
  });

  it('should create the subscription with the configured filter expression', async () => {
    // The local emulator does not enforce filter delivery, so we verify
    // correctness by inspecting the subscription's stored metadata instead.
    const pubsub = new PubSub(CLIENT_CONFIG);
    try {
      const [metadata] = await pubsub
        .subscription('filter_test_subscription')
        .getMetadata();
      expect(metadata.filter).to.eq(FILTER);
    } finally {
      await pubsub.close();
    }
  });
});

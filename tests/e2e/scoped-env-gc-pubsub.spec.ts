import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { expect } from 'chai';
import * as request from 'supertest';
import { GCPubSubServer } from '../../lib';
import { GCPubSubScopedEnvController } from '../src/gc-pubsub-scoped-env.controller';

describe('GC PubSub transport: scoped', () => {
  let server;
  let app: INestApplication;

  describe('useAttributes=false', () => {
    beforeEach(async () => {
      const module = await Test.createTestingModule({
        controllers: [GCPubSubScopedEnvController],
      }).compile();

      app = module.createNestApplication();
      server = app.getHttpAdapter().getInstance();

      app.connectMicroservice({
        strategy: new GCPubSubServer({
          client: {
            apiEndpoint: 'localhost:8681',
            projectId: 'microservice',
          },
          topic: 'server_topic',
          subscription: 'server_subscription',
          scopedEnvKey: 'foobar_',
        }),
      });
      await app.startAllMicroservices();
      await app.init();
    });

    it('/POST', () => {
      return request(server).post('/rpc').expect(200, 'scoped RPC');
    });

    it('/POST (event notification)', (done) => {
      request(server)
        .post('/notify')
        .end(() => {
          setTimeout(() => {
            expect(GCPubSubScopedEnvController.IS_NOTIFIED).to.be.true;
            done();
          }, 1000);
        });
    });

    afterEach(async () => {
      await app.close();
    });
  });
});

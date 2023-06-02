import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { expect } from 'chai';
import * as request from 'supertest';
import { GCPubSubServer } from '../../lib';
import {
  GCPubSubScopedEnvController1,
  GCPubSubScopedEnvController2,
} from '../src/gc-pubsub-scoped-env.controller';

describe('GC PubSub transport', () => {
  let server;
  let app: INestApplication;

  describe('useAttributes=false', () => {
    beforeEach(async () => {
      await Test.createTestingModule({
        controllers: [GCPubSubScopedEnvController2],
      }).compile();
      const module = await Test.createTestingModule({
        controllers: [GCPubSubScopedEnvController1],
      }).compile();

      app = module.createNestApplication();
      server = app.getHttpAdapter().getInstance();

      app.connectMicroservice({
        strategy: new GCPubSubServer({
          client: {
            apiEndpoint: 'localhost:8681',
            projectId: 'microservice',
          },
          scopedEnvKey: 'foobar',
        }),
      });
      await app.startAllMicroservices();
      await app.init();
    });

    it('/POST', () => {
      request(server).post('/rpc').expect(200, 'scoped RPC');
    });

    it('/POST (event notification)', (done) => {
      request(server)
        .post('/notify')
        .end(() => {
          setTimeout(() => {
            expect(GCPubSubScopedEnvController1.IS_NOTIFIED).to.be.true;
            expect(GCPubSubScopedEnvController2.IS_NOTIFIED).to.be.false;
            done();
          }, 1000);
        });
    });

    afterEach(async () => {
      await app.close();
    });
  });
});

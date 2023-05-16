import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { expect } from 'chai';
import * as request from 'supertest';
import { GCPubSubServer } from '../../lib';
import { GCPubSubController } from '../src/gc-pubsub.controller';
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
      topics: ['broadcast', 'test-reply'],
    });
    return emulator.start();
  });

  afterAll(() => {
    return emulator.stop();
  });

  describe('useAttributes=false', () => {
    beforeEach(async () => {
      const module = await Test.createTestingModule({
        controllers: [GCPubSubController],
      }).compile();

      app = module.createNestApplication();
      server = app.getHttpAdapter().getInstance();

      app.connectMicroservice({
        strategy: new GCPubSubServer({
          client: {
            apiEndpoint: 'localhost:8086',
            projectId: 'test-project-id',
          },
          topic: 'broadcast',
          subscription: 'test-sub',
          init: true,
        }),
      });

      await app.startAllMicroservices();
      await app.listen(8000);
    });

    it(`/POST`, () => {
      return request(server)
        .post('/?command=sum')
        .send([1, 2, 3, 4, 5])
        .expect(200, '15');
    });

    it(`/POST (Promise/async)`, () => {
      return request(server)
        .post('/?command=asyncSum')
        .send([1, 2, 3, 4, 5])
        .expect(200)
        .expect(200, '15');
    });

    it(`/POST (Observable stream)`, () => {
      return request(server)
        .post('/?command=streamSum')
        .send([1, 2, 3, 4, 5])
        .expect(200, '15');
    });

    it(`/POST (concurrent)`, () => {
      return request(server)
        .post('/concurrent')
        .send([
          Array.from({ length: 10 }, (v, k) => k + 1),
          Array.from({ length: 10 }, (v, k) => k + 11),
          Array.from({ length: 10 }, (v, k) => k + 21),
          Array.from({ length: 10 }, (v, k) => k + 31),
          Array.from({ length: 10 }, (v, k) => k + 41),
          Array.from({ length: 10 }, (v, k) => k + 51),
          Array.from({ length: 10 }, (v, k) => k + 61),
          Array.from({ length: 10 }, (v, k) => k + 71),
          Array.from({ length: 10 }, (v, k) => k + 81),
          Array.from({ length: 10 }, (v, k) => k + 91),
        ])
        .expect(200, 'true');
    });

    it(`/POST (streaming)`, () => {
      return request(server)
        .post('/stream')
        .send([1, 2, 3, 4, 5])
        .expect(200, '15');
    });

    it(`/POST (event notification)`, (done) => {
      request(server)
        .post('/notify')
        .send([1, 2, 3, 4, 5])
        .end(() => {
          setTimeout(() => {
            expect(GCPubSubController.IS_NOTIFIED).to.be.true;
            done();
          }, 1000);
        });
    });

    afterEach(async () => {
      await app.close();
    });
  });

  describe('useAttributes=true', () => {
    beforeEach(async () => {
      const module = await Test.createTestingModule({
        controllers: [GCPubSubController],
      }).compile();

      app = module.createNestApplication();
      server = app.getHttpAdapter().getInstance();

      app.connectMicroservice({
        strategy: new GCPubSubServer({
          topic: 'broadcast',
          client: {
            apiEndpoint: 'localhost:8086',
            projectId: 'test-project-id',
          },
        }),
      });
      await app.startAllMicroservices();
      await app.init();
    });

    it(`/POST`, () => {
      return request(server)
        .post('/?command=sum')
        .send([1, 2, 3, 4, 5])
        .expect(200, '15');
    });

    it(`/POST (Promise/async)`, () => {
      return request(server)
        .post('/?command=asyncSum')
        .send([1, 2, 3, 4, 5])
        .expect(200)
        .expect(200, '15');
    });

    it(`/POST (Observable stream)`, () => {
      return request(server)
        .post('/?command=streamSum')
        .send([1, 2, 3, 4, 5])
        .expect(200, '15');
    });

    it(`/POST (concurrent)`, () => {
      return request(server)
        .post('/concurrent')
        .send([
          Array.from({ length: 10 }, (v, k) => k + 1),
          Array.from({ length: 10 }, (v, k) => k + 11),
          Array.from({ length: 10 }, (v, k) => k + 21),
          Array.from({ length: 10 }, (v, k) => k + 31),
          Array.from({ length: 10 }, (v, k) => k + 41),
          Array.from({ length: 10 }, (v, k) => k + 51),
          Array.from({ length: 10 }, (v, k) => k + 61),
          Array.from({ length: 10 }, (v, k) => k + 71),
          Array.from({ length: 10 }, (v, k) => k + 81),
          Array.from({ length: 10 }, (v, k) => k + 91),
        ])
        .expect(200, 'true');
    });

    it(`/POST (streaming)`, () => {
      return request(server)
        .post('/stream')
        .send([1, 2, 3, 4, 5])
        .expect(200, '15');
    });

    it(`/POST (event notification)`, (done) => {
      request(server)
        .post('/notify')
        .send([1, 2, 3, 4, 5])
        .end(() => {
          setTimeout(() => {
            expect(GCPubSubController.IS_NOTIFIED).to.be.true;
            done();
          }, 1000);
        });
    });

    afterEach(async () => {
      await app.close();
    });
  });
});

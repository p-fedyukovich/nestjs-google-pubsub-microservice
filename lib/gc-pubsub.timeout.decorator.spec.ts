import { INestApplication } from '@nestjs/common';

import { TimeoutInterceptor } from './gc-pubsub.timeout.decorator';
import { Test } from '@nestjs/testing';
import { GCPubSubTimeoutController } from './gc-pubsub.timeout.controller';
import * as request from 'supertest';
import sinon = require('sinon');

describe('TimeoutInterceptor', () => {
  let server: any;
  let app: INestApplication;
  const clock = sinon.useFakeTimers();
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [GCPubSubTimeoutController],
      providers: [TimeoutInterceptor],
    }).compile();
    app = module.createNestApplication();

    server = app.getHttpAdapter().getInstance();
    await app.init();
  });

  afterEach(async () => {
    clock.restore();
    await app.close();
  });

  afterAll(() => {
    clock.restore();
  });

  it('should return 200 when the endpoint finish executing before timeout', () => {
    const req = request(server).get('/');
    clock.tick(200);
    req.expect(200);
  });

  it('should throw RequestTimeoutError when the request exceeds timeout', () => {
    const req = request(server).get('/fail');
    clock.tick(1000);
    req.expect(408);
  });
});

import { INestApplication } from '@nestjs/common';

import { TimeoutInterceptor } from './gc-pubsub.timeout.decorator';
import { Test } from '@nestjs/testing';
import { GCPubSubTimeoutController } from './gc-pubsub.timeout.controller';
import * as request from 'supertest';

describe('TimeoutInterceptor', () => {
  let server: any;
  let app: INestApplication;
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
    await app.close();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 when the endpoint finish executing before timeout', (done) => {
    request(server).get('/').timeout(200).expect(200).end(done);
  });

  it('should throw RequestTimeoutError when the request exceeds timeout', (done) => {
    request(server).get('/fail').timeout(1900).expect(408).end(done);
  });
});

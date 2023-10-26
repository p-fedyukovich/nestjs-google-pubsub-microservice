import { Controller, Get, RequestTimeoutException } from '@nestjs/common';
import { InjectGCPubSubClient } from '../../lib/gc-client.inject.decorator';
import {
  GCPubSubClient,
  GCPubSubContext,
  GCPubSubMessageBuilder,
} from '../../lib';
import { Ctx, MessagePattern, Payload } from '@nestjs/microservices';
import { catchError, lastValueFrom, take } from 'rxjs';
import { error } from 'console';

@Controller()
export class GCPubSubMessageBuilderController {
  constructor(
    @InjectGCPubSubClient('client1') private clientOne: GCPubSubClient,
    @InjectGCPubSubClient('client2') private clientTwo: GCPubSubClient,
  ) {}

  @Get('/data')
  getData() {
    return this.clientOne.send(
      { cmd: 'data' },
      new GCPubSubMessageBuilder({ data: 'Hello' })
        .setAttributes({
          attrs: 'attrs',
          test: 'test',
        })
        .setOrderingKey('1')
        .build(),
    );
  }

  @Get('/attributes')
  getAttributes() {
    return this.clientOne.send(
      { cmd: 'attributes' },
      new GCPubSubMessageBuilder({ data: 'Hello' })
        .setAttributes({
          attrs: 'attrs',
          test: 'test',
        })
        .setOrderingKey('1')
        .build(),
    );
  }

  @Get('/ordering-key')
  async getOrderingKey() {
    const a = await lastValueFrom(
      this.clientOne.send(
        { cmd: 'ordering-key' },
        new GCPubSubMessageBuilder({ data: 'Hello' })
          .setAttributes({
            attrs: 'attrs',
            test: 'test',
          })
          .setOrderingKey('test1')
          .build(),
      ),
    );

    return a;
  }

  @Get('/multiple-client-test')
  async sendMultipleClient() {
    return this.clientOne.send(
      { cmd: 'multiple-service' },
      new GCPubSubMessageBuilder({
        clientOneId: this.clientOne.clientId,
        clientTwoId: this.clientTwo.clientId,
      }).build(),
    );
  }

  @Get('/timeout')
  async timeoutController() {
    return this.clientOne
      .send(
        { cmd: 'timeoutA' },
        new GCPubSubMessageBuilder({
          data: 'data',
        })
          .setTimeout(1)
          .build(),
      )
      .pipe(
        catchError((err) => {
          if (
            err === 'Message Timeout' ||
            err instanceof RequestTimeoutException
          )
            throw new RequestTimeoutException(err);
          throw new Error(err);
        }),
      );
  }

  @MessagePattern({ cmd: 'data' })
  returnData(
    @Payload() data: { data: string },
    @Ctx() context: GCPubSubContext,
  ) {
    return data.data;
  }

  @MessagePattern({ cmd: 'attributes' })
  returnAttributes(
    @Payload() data: { data: string },
    @Ctx() context: GCPubSubContext,
  ) {
    const attributes = { ...context.getMessage().attributes };
    return attributes;
  }

  @MessagePattern({ cmd: 'ordering-key' })
  returnOrderingKey(
    @Payload() data: { data: string },
    @Ctx() context: GCPubSubContext,
  ) {
    return context.getMessage().orderingKey;
  }

  @MessagePattern({ cmd: 'multiple-service' })
  multipleServiceTest(
    @Payload() data: { clientOneId: string; clientTwoId },
    @Ctx() context: GCPubSubContext,
  ) {
    const message = context.getMessage();

    return {
      incomingClientId: message.attributes._clientId,
      clientOneId: data.clientOneId,
      clientTwoId: data.clientTwoId,
    };
  }

  @MessagePattern({ cmd: 'timeout' })
  timeoutService(
    @Payload() data: { clientOneId: string; clientTwoId },
    @Ctx() context: GCPubSubContext,
  ) {
    return true;
  }
}

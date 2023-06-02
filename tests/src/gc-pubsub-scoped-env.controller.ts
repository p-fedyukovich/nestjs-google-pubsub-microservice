import {
  Controller,
  HttpCode,
  OnApplicationShutdown,
  Post,
} from '@nestjs/common';
import {
  ClientProxy,
  EventPattern,
  MessagePattern,
} from '@nestjs/microservices';
import { GCPubSubClient } from '../../lib';
import { Observable } from 'rxjs';

@Controller()
export class GCPubSubScopedEnvController1 implements OnApplicationShutdown {
  static IS_NOTIFIED = false;

  client: ClientProxy;

  constructor() {
    this.client = new GCPubSubClient({
      client: {
        apiEndpoint: 'localhost:8681',
        projectId: 'microservice',
      },
      replyTopic: 'default_reply_topic',
      replySubscription: 'default_reply_subscription',
      scopedEnvKey: 'foobar',
    });
  }

  onApplicationShutdown(signal?: string) {
    return this.client.close();
  }

  @Post()
  @HttpCode(200)
  call() {
    return this.client.send({ cmd: 'rpc' }, {});
  }

  @Post('notify')
  async sendNotification(): Promise<any> {
    return this.client.emit<{ notification: boolean; id: string }>(
      'notification',
      { notification: true, id: 'id' },
    );
  }

  @MessagePattern({ cmd: 'rpc' })
  rpc(): string {
    return 'scoped RPC';
  }

  @EventPattern('notification')
  eventHandler(data: { notification: boolean; id: string }) {
    GCPubSubScopedEnvController1.IS_NOTIFIED = data.notification;
  }
}

@Controller()
export class GCPubSubScopedEnvController2 implements OnApplicationShutdown {
  static IS_NOTIFIED = false;

  client: ClientProxy;

  constructor() {
    this.client = new GCPubSubClient({
      client: {
        apiEndpoint: 'localhost:8681',
        projectId: 'microservice',
      },
      replyTopic: 'default_reply_topic',
      replySubscription: 'default_reply_subscription',
    });
  }

  onApplicationShutdown(signal?: string) {
    return this.client.close();
  }

  @MessagePattern({ cmd: 'rpc' })
  rpc(): string {
    return 'RPC';
  }

  @EventPattern('notification')
  eventHandler(data: { notification: boolean; id: string }) {
    GCPubSubScopedEnvController2.IS_NOTIFIED = data.notification;
  }
}

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

@Controller()
export class GCPubSubScopedEnvController implements OnApplicationShutdown {
  static IS_NOTIFIED = false;

  client: ClientProxy;

  constructor() {
    this.client = new GCPubSubClient({
      client: {
        apiEndpoint: 'localhost:8681',
        projectId: 'microservice',
      },
      replyTopic: 'client_topic',
      replySubscription: 'client_subscription',
      topic: 'server_topic',
      scopedEnvKey: 'foobar_',
    });
  }

  onApplicationShutdown(signal?: string) {
    return this.client.close();
  }

  @Post('rpc')
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
    GCPubSubScopedEnvController.IS_NOTIFIED = data.notification;
  }
}

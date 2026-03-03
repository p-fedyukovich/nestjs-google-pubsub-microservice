import {
  Controller,
  HttpCode,
  OnApplicationShutdown,
  Post,
} from '@nestjs/common';
import { ClientProxy, EventPattern } from '@nestjs/microservices';
import { GCPubSubClient } from '../../lib';

@Controller()
export class GCPubSubFilterController implements OnApplicationShutdown {
  static MATCHED_RECEIVED = false;

  client: ClientProxy;

  constructor() {
    this.client = new GCPubSubClient({
      client: {
        apiEndpoint: 'localhost:8681',
        projectId: 'microservice',
      },
      topic: 'filter_test_topic',
      useAttributes: true,
    });
  }

  onApplicationShutdown() {
    return this.client.close();
  }

  @Post('emit-matched')
  @HttpCode(200)
  emitMatched(): any {
    return this.client.emit('matched_event', {});
  }

  @EventPattern('matched_event')
  handleMatched() {
    GCPubSubFilterController.MATCHED_RECEIVED = true;
  }
}

import { Controller, Get, OnApplicationShutdown } from '@nestjs/common';
import { MessagePattern, ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { scan, take } from 'rxjs/operators';
import { GCPubSubClient } from '../../lib';

@Controller()
export class GCPubSubBroadcastController implements OnApplicationShutdown {
  client: ClientProxy;

  constructor() {
    this.client = new GCPubSubClient({
      topic: 'broadcast',
      replyTopic: 'default_reply_topic',
      replySubscription: 'broadcast_reply_subscription',
      client: {
        apiEndpoint: 'localhost:8681',
        projectId: 'microservice',
      },
    });
  }

  onApplicationShutdown(signal?: string) {
    return this.client.close();
  }

  @Get('broadcast')
  multicats() {
    return this.client.send<number>({ cmd: 'broadcast' }, {}).pipe(
      scan((a, b) => a + b),
      take(2),
    );
  }

  @MessagePattern({ cmd: 'broadcast' })
  replyBroadcast(): Observable<number> {
    return new Observable((observer) => observer.next(1));
  }
}

import { Controller, Get, OnApplicationShutdown } from '@nestjs/common';
import { MessagePattern, ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { scan, take } from 'rxjs/operators';
import { GCPubSubClient } from '../../lib';
import { GCPubSubMessageBuilder } from '../../lib/gc-message.builder';

@Controller()
export class GCPubSubBroadcastController implements OnApplicationShutdown {
  client: ClientProxy;

  constructor() {
    this.client = new GCPubSubClient({
      topic: 'broadcast',
      replyTopic: 'test_reply',
      replySubscription: 'test_reply-sub',
      subscription: 'test-sub',
      client: {
        apiEndpoint: 'localhost:8086',
        projectId: 'test-project-id',
      },
    });
  }

  onApplicationShutdown(signal?: string) {
    return this.client.close();
  }

  @Get('broadcast')
  multicats() {
    const a = this.client.send<any>(
      'pattern',
      new GCPubSubMessageBuilder<{ data: string }, { attrs: string }>({
        data: 'asfd',
      }).build(),
    );
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

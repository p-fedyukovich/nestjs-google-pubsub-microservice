import {
  Body,
  Controller,
  HttpCode,
  OnApplicationShutdown,
  Post,
  Query,
} from '@nestjs/common';
import {
  ClientProxy,
  EventPattern,
  MessagePattern,
} from '@nestjs/microservices';
import { from, lastValueFrom, Observable, of } from 'rxjs';
import { scan } from 'rxjs/operators';
import { GCPubSubClient } from '../../lib';

@Controller()
export class GCPubSubController implements OnApplicationShutdown {
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

  @Post()
  @HttpCode(200)
  call(@Query('command') cmd, @Body() data: number[]): Observable<number> {
    return this.client.send<number>({ cmd }, data);
  }

  @Post('stream')
  @HttpCode(200)
  stream(@Body() data: number[]): Observable<number> {
    return this.client
      .send<number>({ cmd: 'streaming' }, data)
      .pipe(scan((a, b) => a + b));
  }

  @Post('concurrent')
  @HttpCode(200)
  concurrent(@Body() data: number[][]): Promise<boolean> {
    const send = async (tab: number[]) => {
      const expected = tab.reduce((a, b) => a + b);
      const result = await lastValueFrom(
        this.client.send<number>({ cmd: 'sum' }, tab),
      );

      return result === expected;
    };
    return data
      .map(async (tab) => send(tab))
      .reduce(async (a, b) => (await a) && b);
  }

  @MessagePattern({ cmd: 'sum' })
  sum(data: number[]): number {
    return (data || []).reduce((a, b) => a + b);
  }

  @MessagePattern({ cmd: 'asyncSum' })
  async asyncSum(data: number[]): Promise<number> {
    return (data || []).reduce((a, b) => a + b);
  }

  @MessagePattern({ cmd: 'streamSum' })
  streamSum(data: number[]): Observable<number> {
    return of((data || []).reduce((a, b) => a + b));
  }

  @MessagePattern({ cmd: 'streaming' })
  streaming(data: number[]): Observable<number> {
    return from(data);
  }

  @Post('notify')
  async sendNotification(): Promise<any> {
    return this.client.emit<{ notification: boolean; id: string }>(
      'notification',
      { notification: true, id: 'id' },
    );
  }

  @EventPattern('notification')
  eventHandler(data: { notification: boolean; id: string }) {
    GCPubSubController.IS_NOTIFIED = data.notification;
  }
}

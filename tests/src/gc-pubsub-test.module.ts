import { Module } from '@nestjs/common';
import { GCPubSubClientModule } from '../../lib/gc-pubsub.module';
import { GCPubSubMessageBuilderController } from './gc-pubsub-message-builder.controller';

@Module({
  imports: [
    GCPubSubClientModule.registerAsync([
      {
        name: 'client1',
        useFactory: () => ({
          topic: 'broadcast',
          subscription: 'test-sub',
          replyTopic: 'test_reply',
          replySubscription: 'test_reply-sub',
          client: {
            apiEndpoint: 'localhost:8086',
            projectId: 'test-project-id',
          },
          init: true,
        }),
      },
      {
        name: 'client2',
        useFactory: () => ({
          topic: 'broadcas2',
          subscription: 'test-sub',
          replyTopic: 'test_reply',
          replySubscription: 'test_reply-sub',
          client: {
            apiEndpoint: 'localhost:8086',
            projectId: 'test-project-id',
          },
          init: true,
        }),
      },
    ]),
  ],
  controllers: [GCPubSubMessageBuilderController],
})
export class GCPubSubTestModule {}

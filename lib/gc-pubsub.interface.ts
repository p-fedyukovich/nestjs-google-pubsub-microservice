import { ClientConfig } from '@google-cloud/pubsub';
import { Deserializer, Serializer } from '@nestjs/microservices';
import { PublishOptions } from '@google-cloud/pubsub/build/src/publisher';
import { SubscriberOptions } from '@google-cloud/pubsub/build/src/subscriber';

export interface GCPubSubOptions {
  client?: ClientConfig;
  topic?: string;
  replyTopic?: string;
  subscription?: string;
  replySubscription?: string;
  noAck?: boolean;
  publisher?: PublishOptions;
  subscriber?: SubscriberOptions;
  serializer?: Serializer;
  deserializer?: Deserializer;
}

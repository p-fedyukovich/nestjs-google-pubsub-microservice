import {
  ClientConfig,
  PublishOptions,
  SubscriberOptions,
} from '@google-cloud/pubsub';
import { Deserializer, Serializer } from '@nestjs/microservices';

export interface GCPubSubOptions {
  client?: ClientConfig;
  topic?: string;
  replyTopic?: string;
  subscription?: string;
  replySubscription?: string;
  noAck?: boolean;
  init?: boolean;
  useAttributes?: boolean;
  checkExistence?: boolean;
  scopedEnvKey?: string | null;
  publisher?: PublishOptions;
  subscriber?: SubscriberOptions;
  serializer?: Serializer;
  deserializer?: Deserializer;
}

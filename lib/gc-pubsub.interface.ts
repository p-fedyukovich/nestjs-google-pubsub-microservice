import { ClientConfig, CreateSubscriptionOptions } from '@google-cloud/pubsub';
import { Deserializer, Serializer } from '@nestjs/microservices';
import { PublishOptions } from '@google-cloud/pubsub/build/src/publisher';
import { SubscriberOptions } from '@google-cloud/pubsub/build/src/subscriber';

export interface GCPubSubClientOptions {
  client?: ClientConfig;
  topic?: string;
  replyTopic?: string;
  replySubscription?: string;
  noAck?: boolean;
  init?: boolean;
  checkExistence?: boolean;
  publisher?: PublishOptions;
  subscriber?: SubscriberOptions;
  serializer?: Serializer;
  deserializer?: Deserializer;
  createSubscriptionOptions?: CreateSubscriptionOptions;
  autoResume?: boolean;
  autoDeleteSubscriptionOnShutdown?: boolean;
  clientIdFilter?: boolean;
  appendClientIdToSubscription?: boolean;
}

export interface GCPubSubServerOptions {
  client?: ClientConfig;
  topic?: string;
  subscription?: string;
  noAck?: boolean;
  init?: boolean;
  checkExistence?: boolean;
  publisher?: PublishOptions;
  subscriber?: SubscriberOptions;
  serializer?: Serializer;
  deserializer?: Deserializer;
  createSubscriptionOptions?: CreateSubscriptionOptions;
  autoResume?: boolean;
  ackAfterResponse?: boolean;
}

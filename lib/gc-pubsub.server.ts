import {
  ClientConfig,
  Message,
  PublishOptions,
  PubSub,
  SubscriberOptions,
  Subscription,
} from '@google-cloud/pubsub';
import { Observable } from 'rxjs';
import {
  CustomTransportStrategy,
  IncomingRequest,
  OutgoingResponse,
  Server,
} from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { isString, isUndefined } from '@nestjs/common/utils/shared.utils';

import { GCPubSubOptions } from './gc-pubsub.interface';
import {
  ALREADY_EXISTS,
  GC_PUBSUB_DEFAULT_CLIENT_CONFIG,
  GC_PUBSUB_DEFAULT_INIT,
  GC_PUBSUB_DEFAULT_NO_ACK,
  GC_PUBSUB_DEFAULT_PUBLISHER_CONFIG,
  GC_PUBSUB_DEFAULT_SUBSCRIBER_CONFIG,
  GC_PUBSUB_DEFAULT_SUBSCRIPTION,
  GC_PUBSUB_DEFAULT_TOPIC,
  GC_PUBSUB_DEFAULT_CHECK_EXISTENCE,
} from './gc-pubsub.constants';
import { GCPubSubContext } from './gc-pubsub.context';
import { closePubSub, closeSubscription, flushTopic } from './gc-pubsub.utils';
import { NO_MESSAGE_HANDLER } from '@nestjs/microservices/constants';
import { PubSubEvents, PubSubStatus } from './gc-pubsub.events';

export class GCPubSubServer
  extends Server<PubSubEvents, PubSubStatus>
  implements CustomTransportStrategy
{
  protected logger = new Logger(GCPubSubServer.name);

  protected readonly clientConfig: ClientConfig;
  protected readonly topicName: string;
  protected readonly publisherConfig: PublishOptions;
  protected readonly subscriptionName: string;
  protected readonly subscriberConfig: SubscriberOptions;
  protected readonly noAck: boolean;
  protected readonly replyTopics: Set<string>;
  protected readonly init: boolean;
  protected readonly checkExistence: boolean;
  protected readonly scopedEnvKey: string | null;

  protected client: PubSub | null = null;
  protected subscription: Subscription | null = null;

  constructor(protected readonly options: GCPubSubOptions) {
    super();

    this.clientConfig = this.options.client || GC_PUBSUB_DEFAULT_CLIENT_CONFIG;
    this.scopedEnvKey = this.options.scopedEnvKey ?? '';

    this.topicName = this.options.topic || GC_PUBSUB_DEFAULT_TOPIC;
    this.topicName = `${this.scopedEnvKey}${this.topicName}`;

    this.subscriptionName =
      this.options.subscription || GC_PUBSUB_DEFAULT_SUBSCRIPTION;

    this.subscriptionName = `${this.scopedEnvKey}${this.subscriptionName}`;

    this.subscriberConfig =
      this.options.subscriber || GC_PUBSUB_DEFAULT_SUBSCRIBER_CONFIG;

    this.publisherConfig =
      this.options.publisher || GC_PUBSUB_DEFAULT_PUBLISHER_CONFIG;

    this.noAck = this.options.noAck ?? GC_PUBSUB_DEFAULT_NO_ACK;
    this.init = this.options.init ?? GC_PUBSUB_DEFAULT_INIT;
    this.checkExistence =
      this.options.checkExistence ?? GC_PUBSUB_DEFAULT_CHECK_EXISTENCE;

    this.replyTopics = new Set();

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public async listen(callback: () => void) {
    this.client = this.createClient();
    const topic = this.client.topic(this.topicName);

    if (this.init) {
      await this.createIfNotExists(topic.create.bind(topic));
    } else if (this.checkExistence) {
      const [exists] = await topic.exists();
      if (!exists) {
        const message = `PubSub server is not started: topic ${this.topicName} does not exist`;
        this.logger.error(message);
        throw new Error(message);
      }
    }

    this.subscription = topic.subscription(
      this.subscriptionName,
      this.subscriberConfig,
    );

    if (this.init) {
      await this.createIfNotExists(
        this.subscription.create.bind(this.subscription),
      );
    } else if (this.checkExistence) {
      const [exists] = await this.subscription.exists();
      if (!exists) {
        const message = `PubSub server is not started: subscription ${this.subscriptionName} does not exist`;
        this.logger.error(message);
        throw new Error(message);
      }
    }

    this.subscription
      .on('message', async (message: Message) => {
        await this.handleMessage(message);
        if (this.noAck) {
          message.ack();
        }
      })
      .on('error', (err: any) => this.logger.error(err));

    callback();
  }

  public async close() {
    await closeSubscription(this.subscription);

    await Promise.all(
      Array.from(this.replyTopics.values()).map((replyTopic) => {
        return flushTopic(this.client.topic(replyTopic));
      }),
    );

    this.replyTopics.clear();

    await closePubSub(this.client);
  }

  public async handleMessage(message: Message) {
    const { data, attributes } = message;
    const rawMessage = JSON.parse(data.toString());

    let packet;
    if (attributes.pattern) {
      packet = this.deserializer.deserialize({
        data: rawMessage,
        id: attributes.id,
        pattern: attributes.pattern,
      }) as IncomingRequest;
    } else {
      packet = this.deserializer.deserialize(rawMessage) as IncomingRequest;
    }

    const pattern = isString(packet.pattern)
      ? packet.pattern
      : JSON.stringify(packet.pattern);
    const correlationId = packet.id;

    const context = new GCPubSubContext([message, pattern]);

    if (isUndefined(correlationId)) {
      return this.handleEvent(pattern, packet, context);
    }

    const handler = this.getHandlerByPattern(pattern);

    if (!handler) {
      if (!attributes.replyTo) {
        return;
      }

      const status = 'error';
      const noHandlerPacket = {
        id: correlationId,
        status,
        err: NO_MESSAGE_HANDLER,
      };
      return this.sendMessage(
        noHandlerPacket,
        attributes.replyTo,
        correlationId,
      );
    }

    const response$ = this.transformToObservable(
      await handler(packet.data, context),
    ) as Observable<any>;

    const publish = <T>(data: T) =>
      this.sendMessage(data, attributes.replyTo, correlationId);

    response$ && this.send(response$, publish);
  }

  public async sendMessage<T = any>(
    message: T,
    replyTo: string,
    id: string,
  ): Promise<void> {
    Object.assign(message, { id });

    const outgoingResponse = this.serializer.serialize(
      message as unknown as OutgoingResponse,
    );

    this.replyTopics.add(replyTo);

    await this.client
      .topic(replyTo, this.publisherConfig)
      .publishMessage({ json: outgoingResponse, attributes: { id } });
  }

  public async createIfNotExists(create: () => Promise<any>) {
    try {
      await create();
    } catch (error: any) {
      if (error.code !== ALREADY_EXISTS) {
        throw error;
      }
    }
  }

  public createClient() {
    return new PubSub(this.clientConfig);
  }

  private readonly eventListeners: Map<
    keyof PubSubEvents,
    Array<(...args: any[]) => any>
  > = new Map();

  public on<
    EventKey extends keyof PubSubEvents = keyof PubSubEvents,
    EventCallback extends PubSubEvents[EventKey] = PubSubEvents[EventKey],
  >(event: EventKey, callback: EventCallback): this {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
    return this;
  }

  public unwrap<T = any>(): T {
    if (!this.client) {
      throw new Error('Client is not initialized.');
    }
    return this.client as unknown as T;
  }
}

import {
  ClientConfig,
  CreateSubscriptionOptions,
  CreateSubscriptionResponse,
  Message,
  PubSub,
  Subscription,
} from '@google-cloud/pubsub';
import { PublishOptions } from '@google-cloud/pubsub/build/src/publisher';
import { SubscriberOptions } from '@google-cloud/pubsub/build/src/subscriber';
import { Observable } from 'rxjs';
import {
  CustomTransportStrategy,
  IncomingRequest,
  OutgoingResponse,
  Server,
} from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import {
  ERROR_EVENT,
  MESSAGE_EVENT,
  NO_MESSAGE_HANDLER,
} from '@nestjs/microservices/constants';
import { isString, isUndefined } from '@nestjs/common/utils/shared.utils';

import { GCPubSubServerOptions } from './gc-pubsub.interface';
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
  GC_PUBSUB_DEFAULT_ACK_AFTER_RESPONSE,
} from './gc-pubsub.constants';
import { GCPubSubContext } from './gc-pubsub.context';
import { closePubSub, closeSubscription, flushTopic } from './gc-pubsub.utils';
import { GCPubSubParser, IGCPubSubParser } from './gc-pubsub.parser';
import { GCPubSubResponseSerializer } from './gc-message.serializer';

export class GCPubSubServer extends Server implements CustomTransportStrategy {
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
  protected readonly createSubscriptionOptions: CreateSubscriptionOptions;
  protected readonly ackAfterResponse: boolean;
  protected readonly parser: IGCPubSubParser;

  public client: PubSub | null = null;
  public subscription: Subscription | null = null;

  constructor(protected readonly options: GCPubSubServerOptions) {
    super();

    this.clientConfig = this.options.client || GC_PUBSUB_DEFAULT_CLIENT_CONFIG;

    this.topicName = this.options.topic || GC_PUBSUB_DEFAULT_TOPIC;

    this.subscriptionName =
      this.options.subscription || GC_PUBSUB_DEFAULT_SUBSCRIPTION;

    this.subscriberConfig =
      this.options.subscriber || GC_PUBSUB_DEFAULT_SUBSCRIBER_CONFIG;

    this.publisherConfig =
      this.options.publisher || GC_PUBSUB_DEFAULT_PUBLISHER_CONFIG;

    this.noAck = this.options.noAck ?? GC_PUBSUB_DEFAULT_NO_ACK;
    this.init = this.options.init ?? GC_PUBSUB_DEFAULT_INIT;
    this.checkExistence =
      this.options.checkExistence ?? GC_PUBSUB_DEFAULT_CHECK_EXISTENCE;

    this.createSubscriptionOptions = this.options.createSubscriptionOptions;

    this.replyTopics = new Set();

    this.ackAfterResponse =
      this.options.ackAfterResponse ?? GC_PUBSUB_DEFAULT_ACK_AFTER_RESPONSE;

    this.initializeSerializer(options);
    this.initializeDeserializer(options);

    this.parser = options.parser ?? new GCPubSubParser();
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
        this.subscription.create.bind(
          this.subscription,
          this.createSubscriptionOptions,
        ) as () => Promise<CreateSubscriptionResponse>,
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
      .on(MESSAGE_EVENT, async (message: Message) => {
        await this.handleMessage(message);
        if (this.noAck) {
          message.ack();
        }
      })
      .on(ERROR_EVENT, (err: any) => {
        this.logger.error(err);
      });

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
    const { attributes, publishTime } = message;
    const rawMessage = await this.parser.parse(message);
    const now = new Date();

    const packet = (await this.deserializer.deserialize(
      {
        data: rawMessage,
        id: attributes._id,
        pattern: attributes._pattern,
      },
      { message },
    )) as IncomingRequest;

    const pattern = isString(packet.pattern)
      ? packet.pattern
      : JSON.stringify(packet.pattern);

    const correlationId = packet.id;

    const timeout = Number(attributes._timeout);
    if (timeout && timeout > 0) {
      if (now.getTime() - publishTime.getTime() >= timeout) {
        const timeoutPacket = {
          id: correlationId,
          status: 'error',
          err: 'Message Timeout',
        };
        this.sendMessage(
          timeoutPacket,
          attributes._replyTo,
          correlationId,
          attributes,
        );
        if (!this.noAck) message.ack();
        return;
      }
    }

    const context = new GCPubSubContext([message, pattern]);

    if (isUndefined(correlationId)) {
      return this.handleEvent(pattern, packet, context);
    }

    const handler = this.getHandlerByPattern(pattern);

    if (!handler) {
      if (!attributes._replyTo) {
        return;
      }

      const status = 'error';
      const noHandlerPacket = {
        id: correlationId,
        status,
        err: NO_MESSAGE_HANDLER,
      };
      this.sendMessage(
        noHandlerPacket,
        attributes._replyTo,
        correlationId,
        attributes,
      );
      if (this.noAck) message.ack();
      return;
    }

    const response$ = this.transformToObservable(
      await handler(packet.data, context),
    ) as Observable<any>;

    const publish = <T>(data: T) =>
      this.sendMessage(data, attributes._replyTo, correlationId, attributes);
    response$ && this.send(response$, publish);
    if (this.ackAfterResponse) {
      message.ack();
    }
  }

  public async sendMessage<T = any>(
    message: T,
    replyTo: string,
    id: string,
    attributes?: Record<string, string>,
  ): Promise<void> {
    Object.assign(message, { id });

    const outgoingResponse = await this.serializer.serialize(
      message as OutgoingResponse,
      {
        message: {
          data: message,
          attributes,
        },
      },
    );

    this.replyTopics.add(replyTo);

    await this.client.topic(replyTo, this.publisherConfig).publishMessage({
      data: outgoingResponse.data,
      attributes: {
        id,
        ...attributes,
        ...(outgoingResponse.isDisposed ? { isDisposed: '1' } : {}),
        ...(outgoingResponse.err
          ? { err: JSON.stringify(outgoingResponse.err) }
          : {}),
        ...(outgoingResponse.status ? { status: outgoingResponse.status } : {}),
      },
    });
  }

  protected initializeSerializer(options: GCPubSubServerOptions): void {
    this.serializer = options?.serializer ?? new GCPubSubResponseSerializer();
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
}

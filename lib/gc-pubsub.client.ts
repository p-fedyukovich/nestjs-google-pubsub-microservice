import {
  ClientConfig,
  Message,
  PubSub,
  Subscription,
  Topic,
} from '@google-cloud/pubsub';
import { PublishOptions } from '@google-cloud/pubsub/build/src/publisher';
import { SubscriberOptions } from '@google-cloud/pubsub/build/src/subscriber';
import { Logger } from '@nestjs/common';
import {
  ClientProxy,
  IncomingResponse,
  ReadPacket,
  WritePacket,
} from '@nestjs/microservices';
import { ERROR_EVENT, MESSAGE_EVENT } from '@nestjs/microservices/constants';

import {
  ALREADY_EXISTS,
  GC_PUBSUB_DEFAULT_CLIENT_CONFIG,
  GC_PUBSUB_DEFAULT_INIT,
  GC_PUBSUB_DEFAULT_NO_ACK,
  GC_PUBSUB_DEFAULT_PUBLISHER_CONFIG,
  GC_PUBSUB_DEFAULT_SUBSCRIBER_CONFIG,
  GC_PUBSUB_DEFAULT_TOPIC,
  GC_PUBSUB_DEFAULT_CHECK_EXISTENCE,
  GC_PUBSUB_DEFAULT_AUTO_RESUME,
} from './gc-pubsub.constants';
import { GCPubSubOptions } from './gc-pubsub.interface';
import { closePubSub, closeSubscription, flushTopic } from './gc-pubsub.utils';
import { UUID, randomUUID } from 'crypto';
import { GCPubSubMessageSerializer } from './gc-message.serializer';
import { GCPubSubMessage } from './gc-message.builder';

export class GCPubSubClient extends ClientProxy {
  public readonly clientId: UUID;

  protected readonly logger = new Logger(GCPubSubClient.name);

  protected readonly topicName: string;
  protected readonly publisherConfig: PublishOptions;
  protected readonly replyTopicName?: string;
  protected readonly replySubscriptionName?: string;
  protected readonly clientConfig: ClientConfig;
  protected readonly subscriberConfig: SubscriberOptions;
  protected readonly noAck: boolean;
  protected readonly autoResume: boolean;

  protected client: PubSub | null = null;
  protected replySubscription: Subscription | null = null;
  protected topic: Topic | null = null;
  protected init: boolean;
  protected readonly checkExistence: boolean;

  constructor(protected readonly options: GCPubSubOptions) {
    super();

    this.clientId = randomUUID();

    this.clientConfig = this.options.client || GC_PUBSUB_DEFAULT_CLIENT_CONFIG;

    this.topicName = this.options.topic || GC_PUBSUB_DEFAULT_TOPIC;

    this.subscriberConfig =
      this.options.subscriber || GC_PUBSUB_DEFAULT_SUBSCRIBER_CONFIG;

    this.publisherConfig =
      this.options.publisher || GC_PUBSUB_DEFAULT_PUBLISHER_CONFIG;

    this.replyTopicName = this.options.replyTopic;

    this.replySubscriptionName = this.options.replySubscription;

    this.noAck = this.options.noAck ?? GC_PUBSUB_DEFAULT_NO_ACK;
    this.init = this.options.init ?? GC_PUBSUB_DEFAULT_INIT;
    this.checkExistence =
      this.options.checkExistence ?? GC_PUBSUB_DEFAULT_CHECK_EXISTENCE;
    this.autoResume = this.options.autoResume ?? GC_PUBSUB_DEFAULT_AUTO_RESUME;

    this.initializeSerializer(options);
    this.initializeDeserializer(options);
  }

  public getRequestPattern(pattern: string): string {
    return pattern;
  }

  public async close(): Promise<void> {
    await flushTopic(this.topic);
    await closeSubscription(this.replySubscription);
    await closePubSub(this.client);
    this.client = null;
    this.topic = null;
    this.replySubscription = null;
  }

  async connect(): Promise<PubSub> {
    if (this.client) {
      return this.client;
    }

    this.client = this.createClient();

    this.topic = this.client.topic(this.topicName, this.publisherConfig);

    if (this.checkExistence) {
      const [topicExists] = await this.topic.exists();

      if (!topicExists) {
        const message = `PubSub client is not connected: topic ${this.topicName} does not exist`;
        this.logger.error(message);
        throw new Error(message);
      }
    }

    if (this.replyTopicName && this.replySubscriptionName) {
      const replyTopic = this.client.topic(this.replyTopicName);

      if (this.init) {
        await this.createIfNotExists(replyTopic.create.bind(replyTopic));
      } else if (this.checkExistence) {
        const [exists] = await replyTopic.exists();
        if (!exists) {
          const message = `PubSub client is not connected: topic ${this.replyTopicName} does not exist`;
          this.logger.error(message);
          throw new Error(message);
        }
      }

      this.replySubscription = replyTopic.subscription(
        this.replySubscriptionName,
        this.subscriberConfig,
      );

      if (this.init) {
        await this.createIfNotExists(
          this.replySubscription.create.bind(this.replySubscription),
        );
      } else if (this.checkExistence) {
        const [exists] = await this.replySubscription.exists();
        if (!exists) {
          const message = `PubSub client is not connected: subscription ${this.replySubscription} does not exist`;
          this.logger.error(message);
          throw new Error(message);
        }
      }

      this.replySubscription
        .on(MESSAGE_EVENT, async (message: Message) => {
          try {
            const isHandled = await this.handleResponse(message);

            if (!isHandled) {
              message.nack();
            } else if (this.noAck) {
              message.ack();
            }
          } catch (error) {
            this.logger.error(error);
            if (this.noAck) {
              message.nack();
            }
          }
        })
        .on(ERROR_EVENT, (err: any) => this.logger.error(err));
    }

    return this.client;
  }

  public createClient(): PubSub {
    return new PubSub(this.clientConfig);
  }

  protected async dispatchEvent(packet: ReadPacket): Promise<any> {
    const pattern = this.normalizePattern(packet.pattern);

    if (!this.topic) {
      return;
    }

    const serializedPacket = this.serializer.serialize({
      ...packet,
      pattern,
    }) as GCPubSubMessage;

    const attributes = {
      _replyTo: this.replyTopicName,
      _pattern: this.getRequestPattern(packet.pattern),
      ...(serializedPacket.json?.attributes &&
        serializedPacket.json?.attributes),
    };

    await this.topic.publishMessage({
      json: serializedPacket.json,
      orderingKey: serializedPacket.orderingKey,
      attributes: attributes,
    });
  }
  protected publish(
    partialPacket: ReadPacket,
    callback: (packet: WritePacket) => void,
  ) {
    try {
      const packet = this.assignPacketId(partialPacket);

      const serializedPacket = this.serializer.serialize(
        packet,
      ) as GCPubSubMessage;

      const attributes = {
        _replyTo: this.replyTopicName,
        _pattern: JSON.stringify(this.getRequestPattern(packet.pattern)),
        _id: packet.id,
        _clientId: this.clientId,
        ...(serializedPacket.json?.attributes &&
          serializedPacket.json?.attributes),
      };
      this.routingMap.set(packet.id, callback);
      if (this.topic) {
        this.topic
          .publishMessage({
            json: serializedPacket.json,
            orderingKey: serializedPacket.orderingKey,
            attributes: attributes,
          })
          .catch((err) => {
            if (this.autoResume && serializedPacket.orderingKey) {
              this.topic.resumePublishing(serializedPacket.orderingKey);
            }
            callback({ err });
          });
      } else {
        callback({ err: new Error('Topic is not created') });
      }

      return () => this.routingMap.delete(packet.id);
    } catch (err) {
      callback({ err });
    }
  }

  protected initializeSerializer(options: GCPubSubOptions): void {
    this.serializer = options?.serializer ?? new GCPubSubMessageSerializer();
  }

  public async handleResponse(message: {
    data: Buffer;
    attributes: Record<string, string>;
  }): Promise<boolean> {
    const rawMessage = JSON.parse(message.data.toString());

    const { err, response, isDisposed, id } = this.deserializer.deserialize(
      rawMessage,
    ) as IncomingResponse;

    const correlationId = message.attributes.id || id;

    const callback = this.routingMap.get(correlationId);
    if (!callback) {
      return false;
    }

    if (err || isDisposed) {
      callback({
        err,
        response,
        isDisposed,
      });
    } else {
      callback({
        err,
        response,
      });
    }

    return true;
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
}

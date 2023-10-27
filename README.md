# NestJS Google Cloud Pub/Sub Microservice Transport

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo_text.svg" width="320" alt="Nest Logo" /></a>
</p>

This repository is a fork of [p-fedyukovich/nestjs-google-pubsub-microservice](https://github.com/p-fedyukovich/nestjs-google-pubsub-microservice)

### Google Cloud Pub/Sub

[Pub/Sub](https://cloud.google.com/pubsub) is an asynchronous messaging service that decouples services that produce events from services that process events.

You can use Pub/Sub as messaging-oriented middleware or event ingestion and delivery for streaming analytics pipelines.

Pub/Sub offers durable message storage and real-time message delivery with high availability and consistent performance at scale

#### Installation

To start building Pub/Sub-based microservices, first install the required packages:

```bash
$ npm i --save @google-cloud/pubsub nestjs-google-pubsub-microservice
```

#### Overview

To use the Pub/Sub transporter, pass the following options object to the `createMicroservice()` method:

```typescript
const app = await NestFactory.createMicroservice<MicroserviceOptions>(ApplicationModule, {
  strategy: new GCPubSubServer({
    topic: 'cats_topic',
    subscription: 'cats_subscription',
    client: {
      projectId: 'microservice',
    },
  }),
});
```

#### Options

The `options` property is specific to the chosen transporter. The <strong>GCloud Pub/Sub</strong> transporter exposes the properties described below.

<table>
  <tr>
    <td><code>topic</code></td>
    <td>Topic name which your server subscription will belong to</td>
  </tr>
  <tr>
    <td><code>subscription</code></td>
    <td>Subscription name which your server will listen to</td>
  </tr>
  <tr>
    <td><code>replyTopic</code></td>
    <td>Topic name which your client subscription will belong to</td>
  </tr>
  <tr>
    <td><code>replySubscription</code></td>
    <td>Subscription name which your client will listen to</td>
  </tr>
  <tr>
    <td><code>noAck</code></td>
    <td>If <code>false</code>, manual acknowledgment mode enabled</td>
  </tr>
  <tr>
    <td><code>init</code></td>
    <td>If <code>false</code>, topics and subscriptions will not be created, only validated</td>
  </tr>
  <tr>
    <td><code>checkExistence</code></td>
    <td>If <code>false</code>, topics and subscriptions will not be checked, only used. This only applies when <code>init</code> is <code>false</code></td>
  </tr>
  <tr>
    <td><code>client</code></td>
    <td>Additional client options (read more <a href="https://googleapis.dev/nodejs/pubsub/latest/global.html#ClientConfig" rel="nofollow" target="_blank">here</a>)</td>
  </tr>
  <tr>
    <td><code>publisher</code></td>
    <td>Additional topic publisher options (read more <a href="https://googleapis.dev/nodejs/pubsub/latest/global.html#PublishOptions" rel="nofollow" target="_blank">here</a>)</td>
  </tr>
  <tr>
    <td><code>subscriber</code></td>
    <td>Additional subscriber options (read more <a href="https://googleapis.dev/nodejs/pubsub/latest/global.html#SubscriberOptions" rel="nofollow" target="_blank">here</a>)</td>
  </tr>
  <tr>
    <td><code>createSubscriptionOptions</code></td>
    <td>Options to create subscription if <code>init</code> is set to <code>true</code> and a subscription is needed to be created (read more <a href="https://googleapis.dev/nodejs/pubsub/latest/google.pubsub.v1.ISubscription.html" rel="nofollow" target="_blank">here</a>)</td>
  </tr>
  <tr>
    <td><code>autoResume</code></td>
    <td>Automatically resume publishing a message with ordering key if it fails (read more <a href="https://googleapis.dev/nodejs/pubsub/latest/Topic.html#resumePublishing" rel="nofollow" target="_blank">here</a>)</td>
  </tr>
  <tr>
    <td><code>autoDeleteSubscriptionOnShutdown</code></td>
    <td>Automatically delete the subscription that is connected by the client on shutdown. If the deletion fails, it will close the subscription</td>
  </tr>
  <tr>
    <td><code>clientIdFilter</code></td>
    <td>Allows a client to only receive the response from its own request</td>
  </tr>
  <tr>
    <td><code>appendClientIdtoSubscription</code></td>
    <td>Append client id to the name of the subscription on init</td>
  </tr>
</table>

#### Client

Client can be instantiated by importing `GCPubSubClientModule` to the root module. The clients can be registered with both the `register` method or the `registerAsync` method via `useFactory`.
```typescript
@Module({
  imports: [
    GCPubSubClientModule.register([{
      name: 'client-1'.
      config: options
    }]),
    GCPubSubClientModule.registerAsync([{
      name: 'client-2',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return this.configService.get('GCPubSubClientOptions')
      }
    }])
  ]
})
export class AppModule {}
```

The client can then be injected with `@InjectGCPubSubClient` decorator

```typescript
@Injectable()
export class AppService {
  constructor(
    @InjectGCPubSubClient('client-1') private readonly client: GCPubSUbCLient
  ) {}
}
```

If the token for the client is needed for tests, the package provides a utility function `getGCPubSubClientToken` to retrive the provider token of the client.
```typescript
const token = getGCPubSubClientToken('client-1')
```

#### Message
To fully utilize the features provided by Google PubSub, the message needs to be serialized and deserialized in a certain way to ensure the integrity of the data. Therefore, a helper class, `GCPubSubMessageBuilder` is available to build messages with features such as attributes, ordering key and timeouts.

##### GCPubSubMessageBuilder
<strong>Usage</strong>

```typescript
this.client.send(
    'pattern',
    new GCPubSubMessageBuilder(data)
      .setAttributes(attrs)
      .setOrderingKey('orderingKey')
      .setTimeout(12000)
      .build()
  )
```

<table>
  <caption><b>Constructor &ltTData&gt &ltTAttrs&gt</b></caption>
  <tr>
    <td><code>data?</code></td><td><code>TData</code></td><td>Data of the message payload</td>
  </tr>
  <tr>
    <td><code>attributes?</code></td><td><code>TAttrs</code></td><td>Attributes of the payload</td>
  </tr>
  <tr>
    <td><code>orderingKey?</code></td><td><code>string</code></td><td>Ordering key of the message</td>
  </tr>
  <tr>
    <td><code>timeout?</code></td><td><code>number</code></td><td>Timeout of the message, the request will not be processed if the request exceeds the timeout when it reaches the server</td>
  </tr>
</table>

<table>
  <caption><b>Methods</b></caption>
  <tr>
    <td><code>setData</code></td><td><code>(data: TData) => this</code></td><td>Setting the data of the message</td>
  </tr>
  <tr>
    <td><code>setAttributes</code></td><td><code>(attributes: TAttrs) => this</code></td><td>Setting the attributes of the payload</td>
  </tr>
  <tr>
    <td><code>setOrderingKey</code></td><td><code>(orderingKey: string) => this</code></td><td>Setting the ordering key of the message</td>
  </tr>
  <tr>
    <td><code>setTimeout</code></td><td><code>(timeout: number) => this</code></td><td>Setting the timeout value of the payload</td>
  </tr>
  <tr>
    <td><code>build</code></td><td><code>() => GCPubSubMessage</code></td><td>Build the message, throws error if data is empty</td>
  </tr>
</table>


#### Context

In more sophisticated scenarios, you may want to access more information about the incoming request. When using the Pub/Sub transporter, you can access the `GCPubSubContext` object.

```typescript
@MessagePattern('notifications')
getNotifications(@Payload() data: number[], @Ctx() context: GCPubSubContext) {
  console.log(`Pattern: ${context.getPattern()}`);
}
```

To access the original Pub/Sub message (with the `attributes`, `data`, `ack` and `nack`), use the `getMessage()` method of the `GCPubSubContext` object, as follows:

```typescript
@MessagePattern('notifications')
getNotifications(@Payload() data: number[], @Ctx() context: GCPubSubContext) {
  console.log(context.getMessage());
}
```

#### Message acknowledgement

To make sure a message is never lost, Pub/Sub supports [message acknowledgements](https://cloud.google.com/pubsub/docs/subscriber#at-least-once-delivery). An acknowledgement is sent back by the consumer to tell Pub/Sub that a particular message has been received, processed and that Pub/Sub is free to delete it. If a consumer dies (its subscription is closed, connection is closed, or TCP connection is lost) without sending an ack, Pub/Sub will understand that a message wasn't processed fully and will re-deliver it.

To enable manual acknowledgment mode, set the `noAck` property to `false`:

```typescript
{
  replyTopic: 'cats_topic_reply',
  replySubscription: 'cats_subscription_reply',
  noAck: false,
  client: {
    projectId: 'microservice',
  },
},
```

When manual consumer acknowledgements are turned on, we must send a proper acknowledgement from the worker to signal that we are done with a task.

```typescript
@MessagePattern('notifications')
getNotifications(@Payload() data: number[], @Ctx() context: GCPubSubContext) {
  const originalMsg = context.getMessage();

  originalMsg.ack();
}
```

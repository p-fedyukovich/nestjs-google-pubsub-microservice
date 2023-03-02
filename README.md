# NestJS Google Cloud Pub/Sub Microservice Transport

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo_text.svg" width="320" alt="Nest Logo" /></a>
</p>

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
</table>

#### Client

```typescript
const client = 
  new GCPubSubClient({
      client: {
        apiEndpoint: 'localhost:8681',
        projectId: 'microservice',
      },
    });
client
  .send('pattern', 'Hello world!')
  .subscribe((response) => console.log(response));
```

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

#### Shutdown

Pub/Sub requires a graceful shutdown properly configured in order to work correctly, otherwise some messages acknowledges can be lost. Therefore, don't forget to call client close:

```typescript
export class GCPubSubController implements OnApplicationShutdown {
  client: ClientProxy;

  constructor() {
    this.client = new GCPubSubClient({});
  }

  onApplicationShutdown() {
    return this.client.close();
  }
}
```

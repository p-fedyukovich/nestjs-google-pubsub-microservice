import { PubSub, Subscription, Topic } from '@google-cloud/pubsub';

export async function closeSubscription(
  subscription: Subscription | null,
): Promise<void> {
  if (!subscription) {
    return;
  }

  return new Promise((resolve) => {
    subscription.close(() => resolve());
  });
}

export async function closePubSub(pubsub: PubSub | null): Promise<void> {
  if (!pubsub) {
    return;
  }

  return new Promise((resolve) => {
    pubsub.close(() => resolve());
  });
}

export async function flushTopic(topic: Topic | null): Promise<void> {
  if (!topic) {
    return;
  }

  return new Promise((resolve) => {
    topic.flush(() => resolve());
  });
}

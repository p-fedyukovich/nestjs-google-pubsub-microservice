import { Message } from '@google-cloud/pubsub';

export const enum PubSubStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
}

export type PubSubEvents = {
  message: (message: Message) => void;
  error: (error: Error) => void;
};

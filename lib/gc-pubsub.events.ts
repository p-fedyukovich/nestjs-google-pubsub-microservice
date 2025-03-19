import { StatusError } from '@google-cloud/pubsub';

type VoidCallback = () => void;
type OnErrorCallback = (error: StatusError) => void;

export type PubSubEvents = {
  error: OnErrorCallback;
  close: VoidCallback;
};

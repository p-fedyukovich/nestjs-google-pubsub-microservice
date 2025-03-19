import { StatusError } from '@google-cloud/pubsub';

type VoidCallback = () => void;
type OnErrorCallback = (error: StatusError) => void;

export type GCPubSubEvents = {
  error: OnErrorCallback;
  close: VoidCallback;
};

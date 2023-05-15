import { Inject } from '@nestjs/common';
import { GC_PUBSUB_CLIENT_PREFIX } from './gc-pubsub.constants';

export const getGCPubSubClientToken = (name: string) =>
  GC_PUBSUB_CLIENT_PREFIX + name;

export const InjectGCPubSubClient = (name: string) =>
  Inject(getGCPubSubClientToken(name));

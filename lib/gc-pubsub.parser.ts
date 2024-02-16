import { Message } from '@google-cloud/pubsub';

export interface IGCPubSubParser<TPayload = any> {
  parse(payload: TPayload): Promise<any>;
}

export class GCPubSubParser implements IGCPubSubParser<Message> {
  parse(payload: Message): Promise<any> | any {
    return JSON.parse(payload.data.toString());
  }
}

import { Message } from '@google-cloud/pubsub';
import { BaseRpcContext } from '@nestjs/microservices/ctx-host/base-rpc.context';

type GCPubSubContextArgs<P> = [Message, P];

export class GCPubSubContext<P = string> extends BaseRpcContext<
  GCPubSubContextArgs<P>
> {
  constructor(args: GCPubSubContextArgs<P>) {
    super(args);
  }

  /**
   * Returns the original message (with properties, fields, and content).
   */
  getMessage(): Message {
    return this.args[0];
  }

  /**
   * Returns the name of the pattern.
   */
  getPattern(): P {
    return this.args[1];
  }
}

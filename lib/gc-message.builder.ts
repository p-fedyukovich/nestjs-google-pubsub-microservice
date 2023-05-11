import { PubSub } from '@google-cloud/pubsub';
import { RpcException } from '@nestjs/microservices';

export class GCPubSubMessage<TData = any, TAttrs = any> {
  constructor(
    public readonly json: TData,
    public readonly attributes: TAttrs,
    public readonly orderingKey: string | undefined,
  ) {}
}

export class GCPubSubMessageBuilder<TData, TAttrs extends {}> {
  constructor(
    private data?: TData,
    private attributes?: Partial<TAttrs>,
    private orderingKey?: string,
  ) {}

  public setAttributes(attributes: TAttrs) {
    this.attributes = attributes;
    return this;
  }

  public setData(data: TData) {
    this.data = data;
    return this;
  }

  public setOrderingKey(orderingKey: string) {
    this.orderingKey = orderingKey;
    return this;
  }

  public build() {
    if (!this.data) throw new Error('Missing Data');
    return new GCPubSubMessage<TData, TAttrs>(
      this.data,
      this.attributes as TAttrs,
      this.orderingKey,
    );
  }
}

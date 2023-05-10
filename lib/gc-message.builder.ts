import { PubSub } from '@google-cloud/pubsub';

export class GCPubSubMessage<TData = any, TAttrs = any> {
  constructor(
    public readonly json: TData,
    public readonly attributes: TAttrs,
    public readonly orderingKey: string | undefined,
  ) {}
}

export class GCPubSubMessageBuilder<TData, TAttrs = any> {
  private attributes?: TAttrs;
  private orderingKey?: string;
  constructor(
    private data?: TData,
    attributes?: TAttrs,
    orderingKey?: string,
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
    return new GCPubSubMessage(this.data, this.attributes, this.orderingKey);
  }
}

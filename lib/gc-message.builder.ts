export class GCPubSubMessage<TData = any, TAttrs = any> {
  constructor(
    public readonly data: TData,
    public readonly attributes: TAttrs,
    public readonly orderingKey: string | undefined,
  ) {}
}

type Stringify<T> = {
  [K in keyof T]: T[K] extends string ? T[K] : never;
};

export class GCPubSubMessageBuilder<
  TData,
  TAttrs extends Stringify<TAttrs> = Record<string, string>,
> {
  constructor(
    private data?: TData,
    private attributes: Partial<TAttrs> = {},
    private orderingKey?: string,
    private timeout: number = 0,
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

  public setTimeout(ms: number) {
    this.timeout = ms;
    return this;
  }

  public build() {
    if (!this.data) throw new Error('Missing Data');
    if (this.timeout < 0) throw new Error('Invalid Timeout Value');
    else if (this.timeout > 0)
      (this.attributes as any)._timeout = String(this.timeout);
    return new GCPubSubMessage<TData, TAttrs>(
      this.data,
      this.attributes as TAttrs,
      this.orderingKey,
    );
  }
}

import { expect } from 'chai';
import { GCPubSubMessage, GCPubSubMessageBuilder } from './gc-message.builder';

describe('GCPubSubMessageBuilder', () => {
  const data = { id: 1, name: 'John Doe' };
  const attributes = { category: 'person' };
  const orderingKey = '1';

  it('should build with valid data only', () => {
    const message = new GCPubSubMessageBuilder('data').build();
    expect(message).to.be.instanceOf(GCPubSubMessage);
    expect(message.json).to.equal('data');
    expect(message.attributes).to.be.an('object').and.is.empty;
    expect(message.orderingKey).to.be.undefined;
  });

  it('should throw an error if data is missing', () => {
    const builder = new GCPubSubMessageBuilder();
    builder.setAttributes(attributes).setOrderingKey(orderingKey);

    expect(() => builder.build()).to.throw('Missing Data');
  });

  it('should create a new GCPubSubMessage with the correct parameters', () => {
    const builder = new GCPubSubMessageBuilder(data, attributes, orderingKey);

    const message = builder.build();

    expect(message.json).to.deep.equal(data);
    expect(message.attributes).to.deep.equal(attributes);
    expect(message.orderingKey).to.equal(orderingKey);
  });

  it('should add timeout attribute to attributes if timeout is set', () => {
    const builder = new GCPubSubMessageBuilder(data, attributes, orderingKey);
    builder.setTimeout(500);

    const message = builder.build();

    expect((message.attributes as any).timeout).to.equal(500);
  });

  it('should assign timeout attribute to attributes if timeout is set and attributes are empty', () => {
    const builder = new GCPubSubMessageBuilder(data);
    builder.setTimeout(500);

    const message = builder.build();

    expect((message.attributes as any).timeout).to.equal(500);
  });

  it('should throw an error if timeout is negative', () => {
    const builder = new GCPubSubMessageBuilder(data);
    builder.setTimeout(-1);

    expect(() => builder.build()).to.throw('Invalid Timeout Value');
  });

  it('should create a new GCPubSubMessage with the correct parameters with timeout', () => {
    const builder = new GCPubSubMessageBuilder(
      data,
      attributes,
      orderingKey,
    ).setTimeout(500);

    const message = builder.build();

    expect(message.json).to.deep.equal(data);
    expect(message.attributes).to.deep.equal(
      Object.assign(attributes, { timeout: 500 }),
    );
    expect(message.orderingKey).to.equal(orderingKey);
    expect((message.attributes as any).timeout).to.equal(500);
  });
});

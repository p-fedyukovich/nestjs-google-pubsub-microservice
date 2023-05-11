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
    expect(message.attributes).to.be.undefined;
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
});

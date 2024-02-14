import { expect } from 'chai';
import { GCPubSubMessage, GCPubSubMessageBuilder } from './gc-message.builder';

interface TestData {
  id: number;
  name: string;
}

interface TestAttributes {
  category: string;
}

describe('GCPubSubMessageBuilder', () => {
  let builder: GCPubSubMessageBuilder<TestData, TestAttributes>;
  const data = { id: 1, name: 'John Doe' };
  const attributes = { category: 'person' };
  const orderingKey = '1';

  beforeEach(() => {
    builder = new GCPubSubMessageBuilder(data, attributes, orderingKey, 50);
  });

  describe('setAttributes', () => {
    it('should set the attributes correctly', () => {
      const attributes = { category: 'animals' };

      const result = builder.setAttributes(attributes).build();

      expect(result.attributes).to.deep.equal(attributes);
    });
  });

  describe('setData', () => {
    it('should set the data correctly', () => {
      const tempData = { id: 2, name: 'Paul' };
      const result = builder.setData(tempData).build();

      expect(result.data).to.equal(tempData);
    });
  });

  describe('setOrderingKey', () => {
    it('should set the ordering key correctly', () => {
      const orderingKey = '1';

      const result = builder.setOrderingKey(orderingKey).build();

      expect(result.orderingKey).to.equal(orderingKey);
    });
  });

  describe('setTimeout', () => {
    it('should add timeout attribute to attributes if timeout is set', () => {
      const builder = new GCPubSubMessageBuilder(data, attributes, orderingKey);
      builder.setTimeout(500);

      const message = builder.build();

      expect((message.attributes as any)._timeout).to.equal('500');
    });

    it('should assign timeout attribute to attributes if timeout is set and attributes are empty', () => {
      const builder = new GCPubSubMessageBuilder(data);
      builder.setTimeout(500);

      const message = builder.build();

      expect((message.attributes as any)._timeout).to.equal('500');
    });

    it('should throw an error if timeout is negative', () => {
      const builder = new GCPubSubMessageBuilder(data);
      builder.setTimeout(-1);

      expect(() => builder.build()).to.throw('Invalid Timeout Value');
    });
  });
  it('should create a new GCPubSubMessage with the correct parameters with timeout', () => {
    const builder = new GCPubSubMessageBuilder(
      data,
      attributes,
      orderingKey,
    ).setTimeout(500);

    const message = builder.build();

    expect(message.data).to.deep.equal(data);
    expect(message.attributes).to.deep.equal(
      Object.assign(attributes, { timeout: 500 }),
    );
    expect(message.orderingKey).to.equal(orderingKey);
    expect((message.attributes as any)._timeout).to.equal('500');
  });

  describe('#build', () => {
    it('should build with valid data only', () => {
      const message = new GCPubSubMessageBuilder('data').build();
      expect(message).to.be.instanceOf(GCPubSubMessage);
      expect(message.data).to.equal('data');
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

      expect(message.data).to.deep.equal(data);
      expect(message.attributes).to.deep.equal(attributes);
      expect(message.orderingKey).to.equal(orderingKey);
    });
    it('should create a new GCPubSubMessage with the correct parameters with timeout', () => {
      const builder = new GCPubSubMessageBuilder(
        data,
        attributes,
        orderingKey,
      ).setTimeout(500);

      const message = builder.build();

      expect(message.data).to.deep.equal(data);
      expect(message.attributes).to.deep.equal(
        Object.assign(attributes, { timeout: 500 }),
      );
      expect(message.orderingKey).to.equal(orderingKey);
      expect((message.attributes as any)._timeout).to.equal('500');
    });
  });
});

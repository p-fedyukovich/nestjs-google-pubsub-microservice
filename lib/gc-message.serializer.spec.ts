import { expect } from 'chai';
import { GCPubSubMessageBuilder } from './gc-message.builder';
import { GCPubSubMessageSerializer } from './gc-message.serializer';

describe('GCPubSubMessageSerializer', () => {
  let instance: GCPubSubMessageSerializer;
  beforeEach(() => {
    instance = new GCPubSubMessageSerializer();
  });
  describe('serialize', () => {
    it('undefined', () => {
      expect(instance.serialize({ data: undefined })).to.deep.eq({
        json: undefined,
        attributes: undefined,
        orderingKey: undefined,
      });
    });

    it('null', () => {
      expect(instance.serialize({ data: null })).to.deep.eq({
        json: null,
        attributes: undefined,
        orderingKey: undefined,
      });
    });

    it('string', () => {
      expect(instance.serialize({ data: 'string' })).to.deep.eq({
        json: 'string',
        attributes: undefined,
        orderingKey: undefined,
      });
    });

    it('number', () => {
      expect(instance.serialize({ data: 12345 })).to.deep.eq({
        json: 12345,
        attributes: undefined,
        orderingKey: undefined,
      });
    });

    it('array', () => {
      expect(instance.serialize({ data: [1, 2, 3, 4, 5] })).to.deep.eq({
        json: [1, 2, 3, 4, 5],
        attributes: undefined,
        orderingKey: undefined,
      });
    });

    it('object', () => {
      const serObject = { prop: 'value' };
      expect(instance.serialize({ data: serObject })).to.deep.eq({
        json: {
          prop: 'value',
        },
        attributes: undefined,
        orderingKey: undefined,
      });
    });

    it('GCPMessage with attributes', () => {
      const attributes = {
        key: 'abcde',
      };
      const message = new GCPubSubMessageBuilder({
        value: 'string',
      })
        .setAttributes(attributes)
        .build();
      expect(instance.serialize({ data: message })).to.deep.eq({
        json: {
          value: 'string',
        },
        attributes: {
          key: 'abcde',
        },
        orderingKey: undefined,
      });
    });

    it('GCPMessage with orderingKey', () => {
      const orderingKey = 'key';
      const message = new GCPubSubMessageBuilder({
        value: 'string',
      })
        .setOrderingKey(orderingKey)
        .build();
      expect(instance.serialize({ data: message })).to.deep.eq({
        json: {
          value: 'string',
        },
        orderingKey: 'key',
        attributes: undefined,
      });
    });

    it('GCPMessage with attributes and orderingKey', () => {
      const orderingKey = 'key';
      const message = new GCPubSubMessageBuilder({
        value: 'string',
      })
        .setOrderingKey(orderingKey)
        .setAttributes({ key: 'key' })
        .build();
      expect(instance.serialize({ data: message })).to.deep.eq({
        json: {
          value: 'string',
        },
        orderingKey: 'key',
        attributes: { key: 'key' },
      });
    });
  });
});

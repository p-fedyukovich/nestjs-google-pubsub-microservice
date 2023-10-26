import { expect } from 'chai';

import { GCPubSubMessageBuilder, GCPubSubMessage } from './gc-message.builder';
import { GCPubSubMessageSerializer } from './gc-message.serializer';
import { SinonSandbox, SinonStub } from 'sinon';
import sinon = require('sinon');

describe('GCPubSubMessageSerializer', () => {
  let serializer: GCPubSubMessageSerializer = new GCPubSubMessageSerializer();
  let sandbox: SinonSandbox = sinon.createSandbox();
  let buildStub: SinonStub;

  beforeEach(() => {
    buildStub = sandbox.stub(GCPubSubMessageBuilder.prototype, 'build');
  });

  afterEach(() => {
    sandbox.restore();
    buildStub.reset();
  });

  it('should return a GCPubSubMessage instance', () => {
    buildStub.returns(
      new GCPubSubMessage({ key: 'value' }, { attr: 'value' }, undefined),
    );
    const data = { key: 'value' };
    const attributes = { attr: 'value' };
    const msg = new GCPubSubMessageBuilder(data)
      .setAttributes(attributes)
      .build();
    const packet = { data: msg, pattern: 'test' };
    const message = new GCPubSubMessage(data, attributes, undefined);

    const result = serializer.serialize(packet);

    expect(result).to.deep.equal(message);
  });

  it('should create a new GCPubSubMessage using GCPubSubMessageBuilder if packet data is not a GCPubSubMessage', () => {
    const data = 'data';
    buildStub.returns(new GCPubSubMessage(data, undefined, undefined));
    const packet = { data: data, pattern: 'test' };

    const result = serializer.serialize(packet);

    expect(result).to.be.an.instanceOf(GCPubSubMessage);
    expect(buildStub.calledOnce).to.be.true;
  });
});

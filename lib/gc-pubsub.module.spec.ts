import {
  DynamicModule,
  FactoryProvider,
  Provider,
  ValueProvider,
} from '@nestjs/common';
import { GCPubSubModule } from './gc-pubsub.module';
import { expect } from 'chai';
import { GCPubSubClient } from './gc-pubsub.client';
import sinon = require('sinon');
import { getGCPubSubClientToken } from './gc-client.inject.decorator';

describe('GCPubSubModule', () => {
  let dynamicModule: DynamicModule;
  describe('register', () => {
    const moduleConfigs = [
      {
        name: 'name1',
        config: {},
      },
      {
        name: 'name2',
        config: {},
      },
    ];
    beforeEach(() => {
      dynamicModule = GCPubSubModule.register(moduleConfigs);
    });

    it('should return an expected module ref', () => {
      expect(dynamicModule.module).to.be.equal(GCPubSubModule);
    });
    it('should return a provider array', () =>
      dynamicModule.providers.forEach((provider, index) => {
        expect((provider as ValueProvider).provide).to.equal(
          getGCPubSubClientToken(moduleConfigs[index].name),
        );
        expect((provider as ValueProvider).useValue).to.be.instanceOf(
          GCPubSubClient,
        );
      }));
  });

  describe('registerAsync', () => {
    const useFactory = () => {
      return {};
    };
    const registerOption = {
      name: 'test',
      useFactory,
    };
    it('should return an expected module ref', () => {
      dynamicModule = GCPubSubModule.registerAsync([registerOption]);
      expect(dynamicModule.module).to.be.eql(GCPubSubModule);
    });

    describe('when useFactory', () => {
      it('should return an expected providers array with useFactory', () => {
        dynamicModule = GCPubSubModule.registerAsync([registerOption]);
        expect(dynamicModule.imports).to.be.deep.eq([]);
        expect(dynamicModule.exports).to.be.eq(dynamicModule.providers);
        console.log(dynamicModule);
        expect(dynamicModule.providers).to.be.have.length(1);

        const provider = dynamicModule.providers[0] as FactoryProvider;
        expect(provider.provide).to.be.eql(getGCPubSubClientToken('test'));
        expect(provider.inject).to.be.deep.eq([]);
        expect(provider.useFactory).to.be.an.instanceOf(Function);
      });
    });
  });
});

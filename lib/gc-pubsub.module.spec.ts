import { DynamicModule, FactoryProvider, ValueProvider } from '@nestjs/common';
import { GCPubSubClientModule } from './gc-pubsub.module';
import { expect } from 'chai';
import { GCPubSubClient } from './gc-pubsub.client';
import { getGCPubSubClientToken } from './gc-client.inject.decorator';

const removeClientId = (data: any) => {
  delete data.clientId;
  return data;
};

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
      dynamicModule = GCPubSubClientModule.register(moduleConfigs as any);
    });

    it('should return an expected module ref', () => {
      expect(dynamicModule.module).to.be.equal(GCPubSubClientModule);
    });
    it('should return a provider array', () =>
      dynamicModule.providers.forEach((provider, index) => {
        expect((provider as ValueProvider).provide).to.equal(
          getGCPubSubClientToken(moduleConfigs[index].name),
        );
        expect((provider as ValueProvider).useValue).to.be.instanceOf(
          GCPubSubClient,
        );
        expect(
          removeClientId((provider as ValueProvider).useValue),
        ).to.deep.equal(
          GCPubSubClientModule['assignOnAppShutdownHook'](
            removeClientId(new GCPubSubClient({} as any)),
          ),
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
      dynamicModule = GCPubSubClientModule.registerAsync([
        registerOption as any,
      ]);
      expect(dynamicModule.module).to.be.eql(GCPubSubClientModule);
    });

    describe('when useFactory', () => {
      it('should return an expected providers array with useFactory', () => {
        dynamicModule = GCPubSubClientModule.registerAsync([
          registerOption as any,
        ]);
        expect(dynamicModule.imports).to.be.deep.eq([]);
        expect(dynamicModule.exports).to.be.eq(dynamicModule.providers);
        expect(dynamicModule.providers).to.be.have.length(1);

        const provider = dynamicModule.providers[0] as FactoryProvider;
        expect(provider.provide).to.be.eql(getGCPubSubClientToken('test'));
        expect(provider.inject).to.be.deep.eq([]);
        expect(provider.useFactory).to.be.an.instanceOf(Function);
      });
    });
  });
});

import {
  DynamicModule,
  Global,
  Module,
  ModuleMetadata,
  OnApplicationShutdown,
  Provider,
} from '@nestjs/common';
import { TimeoutInterceptor } from './gc-pubsub.timeout.decorator';
import { GCPubSubClientOptions } from './gc-pubsub.interface';
import { ClientProxy, Closeable } from '@nestjs/microservices';
import { GCPubSubClient } from './gc-pubsub.client';
import { getGCPubSubClientToken } from './gc-client.inject.decorator';

export interface GCPubSubRegisterClientOptions {
  name: string;
  config: GCPubSubClientOptions;
}

export interface GCPubSubRegisterClientAsyncOption
  extends Pick<ModuleMetadata, 'imports'> {
  name: string;
  useFactory?: (
    ...args: any[]
  ) => Promise<GCPubSubClientOptions> | GCPubSubClientOptions;
  inject?: any[];
  extraProviders?: Provider[];
}

@Global()
@Module({
  providers: [TimeoutInterceptor],
  exports: [TimeoutInterceptor],
})
export class GCPubSubClientModule {
  static register(options: GCPubSubRegisterClientOptions[]): DynamicModule {
    const clients: any = options.map((option) => {
      return {
        provide: getGCPubSubClientToken(option.name),
        useValue: this.assignOnAppShutdownHook(
          new GCPubSubClient(option.config),
        ),
      };
    });
    return {
      module: GCPubSubClientModule,
      providers: clients,
      exports: clients,
    };
  }

  static registerAsync(
    options: GCPubSubRegisterClientAsyncOption[],
  ): DynamicModule {
    const providers: Provider[] = options.reduce(
      (accProvider: Provider[], item) =>
        accProvider
          .concat([this.createAsyncProviders(item)])
          .concat(item.extraProviders || []),
      [],
    );

    const imports = options.reduce(
      (accImports, option) =>
        option.imports && !accImports.includes(option.imports)
          ? accImports.concat(option.imports)
          : accImports,
      [],
    );
    return {
      module: GCPubSubClientModule,
      providers: providers,
      exports: providers,
      imports: imports,
    };
  }

  private static createAsyncProviders(
    options: GCPubSubRegisterClientAsyncOption,
  ): Provider {
    return {
      provide: getGCPubSubClientToken(options.name),
      useFactory: this.createFactoryWrapper(options.useFactory),
      inject: options.inject || [],
    };
  }

  private static createFactoryWrapper(
    useFactory: GCPubSubRegisterClientAsyncOption['useFactory'],
  ) {
    return async (...args: any[]) => {
      const clientOptions = await useFactory(...args);
      const clientProxyRef = new GCPubSubClient(clientOptions);
      return this.assignOnAppShutdownHook(clientProxyRef);
    };
  }

  private static assignOnAppShutdownHook(client: ClientProxy & Closeable) {
    (client as unknown as OnApplicationShutdown).onApplicationShutdown =
      client.close;
    return client;
  }
}

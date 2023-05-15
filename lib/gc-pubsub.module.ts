import {
  DynamicModule,
  Global,
  Module,
  ModuleMetadata,
  OnApplicationShutdown,
  Provider,
} from '@nestjs/common';
import { TimeoutInterceptor } from './gc-pubsub.timeout.decorator';
import { GCPubSubOptions } from './gc-pubsub.interface';
import { ClientProxy, Closeable } from '@nestjs/microservices';
import { GCPubSubClient } from './gc-pubsub.client';

export interface GCPubSubRegisterClientOptions {
  name: string;
  config: GCPubSubOptions;
}

export interface GCPubSubRegisterClientAsyncOption
  extends Pick<ModuleMetadata, 'imports'> {
  name: string;
  useFactory?: (...args: any[]) => Promise<GCPubSubOptions> | GCPubSubOptions;
  inject?: any[];
  extraProviders?: Provider[];
}

@Module({
  providers: [TimeoutInterceptor],
  exports: [TimeoutInterceptor],
})
@Global()
export class GCPubSubModule {
  static register(options: GCPubSubRegisterClientOptions[]): DynamicModule {
    const clients: any = options.map((option) => {
      return {
        provide: option.name,
        useValue: this.assignOnAppShutdownHook(
          new GCPubSubClient(option.config),
        ),
      };
    });
    return {
      module: GCPubSubModule,
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
      module: GCPubSubModule,
      providers: providers,
      exports: providers,
      imports: imports,
    };
  }

  private static createAsyncProviders(
    options: GCPubSubRegisterClientAsyncOption,
  ): Provider {
    return {
      provide: options.name,
      useFactory: this.createFactoryWrapper(options.useFactory),
      inject: options.inject || [],
    };
  }

  private static createFactoryWrapper(
    useFactory: GCPubSubRegisterClientAsyncOption['useFactory'],
  ) {
    return async (args: any[]) => {
      const clientOptions = await useFactory(...args);
      const clientProxyRef = new GCPubSubClient(clientOptions);
      const client = this.assignOnAppShutdownHook(clientProxyRef);
    };
  }

  private static assignOnAppShutdownHook(client: ClientProxy & Closeable) {
    (client as unknown as OnApplicationShutdown).onApplicationShutdown =
      client.close;
    return client;
  }
}

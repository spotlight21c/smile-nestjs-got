import { randomUUID } from 'node:crypto';
import { type DynamicModule, Module, type Provider, type Type } from '@nestjs/common';
import type { Got } from './got.types';
import { GOT_INSTANCE_TOKEN, GOT_MODULE_ID, GOT_MODULE_OPTIONS } from './http.constants';
import { HttpService } from './http.service';
import type { HttpModuleAsyncOptions, HttpModuleOptions, HttpModuleOptionsFactory } from './interfaces';
import { PaginationService } from './pagination.service';
import { StreamService } from './stream.service';

/**
 * Loads the pure-ESM `got` package from a CommonJS build via dynamic import
 * and applies the given module options through `got.extend()`.
 */
async function createGotInstance(options: HttpModuleOptions = {}): Promise<Got> {
  const { global: _global, ...gotOptions } = options;
  const { default: got } = await import('got');
  return got.extend(gotOptions);
}

@Module({
  providers: [
    HttpService,
    StreamService,
    PaginationService,
    {
      provide: GOT_INSTANCE_TOKEN,
      useFactory: (): Promise<Got> => createGotInstance(),
    },
  ],
  exports: [HttpService, StreamService, PaginationService],
})
export class HttpModule {
  static register(options: HttpModuleOptions = {}): DynamicModule {
    return {
      module: HttpModule,
      global: options.global,
      providers: [
        {
          provide: GOT_INSTANCE_TOKEN,
          useFactory: (): Promise<Got> => createGotInstance(options),
        },
        {
          provide: GOT_MODULE_ID,
          useValue: randomUUID(),
        },
      ],
    };
  }

  static registerAsync(options: HttpModuleAsyncOptions): DynamicModule {
    return {
      module: HttpModule,
      global: options.global,
      imports: options.imports,
      providers: [
        ...HttpModule.createAsyncProviders(options),
        {
          provide: GOT_INSTANCE_TOKEN,
          useFactory: (config: HttpModuleOptions): Promise<Got> => createGotInstance(config),
          inject: [GOT_MODULE_OPTIONS],
        },
        {
          provide: GOT_MODULE_ID,
          useValue: randomUUID(),
        },
        ...(options.extraProviders || []),
      ],
    };
  }

  private static createAsyncProviders(options: HttpModuleAsyncOptions): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [HttpModule.createAsyncOptionsProvider(options)];
    }
    return [
      HttpModule.createAsyncOptionsProvider(options),
      {
        provide: HttpModule.requireOptionsFactory(options),
        useClass: HttpModule.requireOptionsFactory(options),
      },
    ];
  }

  private static createAsyncOptionsProvider(options: HttpModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: GOT_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }
    return {
      provide: GOT_MODULE_OPTIONS,
      useFactory: async (optionsFactory: HttpModuleOptionsFactory) => optionsFactory.createHttpOptions(),
      inject: [options.useExisting ?? HttpModule.requireOptionsFactory(options)],
    };
  }

  private static requireOptionsFactory(options: HttpModuleAsyncOptions): Type<HttpModuleOptionsFactory> {
    if (!options.useClass) {
      throw new Error('Invalid HttpModule async options: provide one of useFactory, useClass, or useExisting.');
    }
    return options.useClass;
  }
}

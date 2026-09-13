import type { FactoryProvider, ModuleMetadata, Provider, Type } from '@nestjs/common';
import type { ExtendOptions } from '../got.types';

export type HttpModuleOptions = ExtendOptions & {
  global?: boolean;
};

export interface HttpModuleOptionsFactory {
  createHttpOptions(): Promise<HttpModuleOptions> | HttpModuleOptions;
}

export interface HttpModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<HttpModuleOptionsFactory>;
  useClass?: Type<HttpModuleOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<HttpModuleOptions> | HttpModuleOptions;
  inject?: FactoryProvider['inject'];
  extraProviders?: Provider[];
  global?: boolean;
}

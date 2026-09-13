// Centralizes every type-only import from the pure-ESM `got` package.
// The `resolution-mode` import attribute is required so this CommonJS build
// can reference got's ESM types, but Biome's parser rejects the TS-specific
// `import type ... with {...}` syntax — so this file is the single place that
// uses it, and it is excluded from Biome in biome.json.
export type {
  ExtendOptions,
  Got,
  OptionsOfBufferResponseBody,
  OptionsOfJSONResponseBody,
  OptionsOfTextResponseBody,
  OptionsOfUnknownResponseBody,
  OptionsWithPagination,
  Request,
  Response,
  StreamOptions,
} from 'got' with { 'resolution-mode': 'import' };

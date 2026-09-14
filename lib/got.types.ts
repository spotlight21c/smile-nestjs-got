// Centralizes every type-only import from the pure-ESM `got` package.
// The `resolution-mode` import attribute is required so this CommonJS build
// can reference got's ESM types, but Biome's parser rejects the TS-specific
// `import type ... with {...}` syntax — so this file is the single place that
// uses it, and it is excluded from Biome in biome.json.
import type {
  ExtendOptions,
  Got,
  OptionsOfBufferResponseBody,
  OptionsOfJSONResponseBody,
  OptionsOfTextResponseBody,
  OptionsWithPagination,
  Request,
  Response,
  StreamOptions,
  StrictOptions,
} from 'got' with { 'resolution-mode': 'import' };

export type {
  ExtendOptions,
  Got,
  OptionsOfBufferResponseBody,
  OptionsOfJSONResponseBody,
  OptionsOfTextResponseBody,
  OptionsWithPagination,
  Request,
  Response,
  StreamOptions,
  StrictOptions,
};

// got 16 dropped `OptionsOfUnknownResponseBody` in favor of `StrictOptions`.
// Since `StrictOptions` exists in got 14, 15, and 16, we alias it here to keep
// backwards compatibility across all supported got versions (14–16).
export type OptionsOfUnknownResponseBody = StrictOptions;

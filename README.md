# smile-nestjs-got

A [NestJS](https://nestjs.com/) HTTP module built on [got](https://github.com/sindresorhus/got), exposing got's request, streaming and pagination APIs through RxJS Observables.

The module/service surface intentionally mirrors the official [`@nestjs/axios`](https://github.com/nestjs/axios) (`HttpModule` / `HttpService`), so migrating from axios is mostly mechanical.

## When to use this (and when not)

Already happy with `@nestjs/axios`? **Keep it.** Migrating touches every call site (request options, error classes, stricter JSON parsing), and that cost isn't worth paying for features you don't need.

This package is for you when:

- **You're starting a new service** and want got's extras from day one:
  built-in retries and pagination (axios has neither), granular per-phase
  timeouts, and first-class streaming with upload/download progress events.
- **You already wanted got** but were blocked by its pure-ESM packaging in a
  CommonJS NestJS app — this package removes that hurdle entirely.
- **You've outgrown axios** on a specific pain: hand-rolled retry
  interceptors, pagination loops, streaming ergonomics, or HTTP/2.

The `@nestjs/axios`-compatible surface isn't the reason to switch — it's what makes switching cheap once you have a reason.

## Requirements

- Node.js **>= 20.19** (`AbortSignal.any` is used internally; got ^15 and ^16 require Node >= 22)
- got **^14 || ^15 || ^16** (peer dependency)

> This package is published as CommonJS and loads got via dynamic `import()`, so it works in both CommonJS and ESM NestJS applications without any extra setup.

## Installation

```bash
npm i smile-nestjs-got got
```

## Usage

### Register the module

```ts
import { Module } from '@nestjs/common';
import { HttpModule } from 'smile-nestjs-got';

@Module({
  imports: [
    HttpModule.register({
      prefixUrl: 'https://api.example.com',
      headers: { 'user-agent': 'my-app' },
      // global: true, // register as a global module
    }),
  ],
})
export class AppModule {}
```

### Async registration

```ts
HttpModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    prefixUrl: config.getOrThrow<string>('API_URL'),
  }),
});
```

`useClass` / `useExisting` (implementing `HttpModuleOptionsFactory` with `createHttpOptions()`) and `extraProviders` are also supported.

### Making requests

```ts
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { HttpService } from 'smile-nestjs-got';

@Injectable()
export class CatsService {
  constructor(private readonly httpService: HttpService) {}

  async findAll() {
    const response = await firstValueFrom(this.httpService.get<Cat[]>('cats'));
    return response.data; // alias of response.body
  }
}
```

`HttpService` exposes `request`, `head`, `get`, `post`, `put`, `patch`, `delete`, each returning an `Observable<HttpResponse<T>>` (`head` has no body, so it returns `Observable<HttpResponse<string>>`). Passing `responseType: 'text'` or `'buffer'` narrows the body type to `string` / `Uint8Array` automatically via overloads. Unsubscribing aborts the underlying request via `AbortController`. A `signal` you pass in the options is merged with the internal one, so either can abort the request — your signal's abort surfaces as an error on the Observable.

All methods default to `responseType: 'json'` **except `head`** (HEAD responses have no body to parse). Empty 2xx bodies are fine (got returns `''`), but a non-empty, non-JSON 2xx body throws a `ParseError` — pass `responseType: 'text'` for such endpoints:

```ts
this.httpService.post('jobs/1/restart', { responseType: 'text' });
```

`HttpResponse<T>` is got's `Response<T>` plus axios-compatible aliases:

| axios alias           | got native               |
| --------------------- | ------------------------ |
| `response.data`       | `response.body`          |
| `response.status`     | `response.statusCode`    |
| `response.statusText` | `response.statusMessage` |

### Pagination (got extra)

```ts
// Emit one array with every item across all pages:
this.httpService.pagination.all<Item>('items');

// Emit each item individually:
this.httpService.pagination.each<Item>('items');
```

### Streaming (got extra)

```ts
// Returns the raw got Duplex stream — pipe it wherever you need:
const stream = this.httpService.stream.get('large-file');
stream.pipe(res);
```

### Raw got instance

```ts
this.httpService.gotRef; // the underlying got instance
this.httpService.axiosRef; // alias of gotRef (for @nestjs/axios compatibility)
```

## Migrating from @nestjs/axios

> See **[MIGRATION.md](./MIGRATION.md)** for the full step-by-step guide.

The dependency-injection surface is identical, so wiring stays the same:

```ts
// Before
import { HttpModule, HttpService } from '@nestjs/axios';
// After
import { HttpModule, HttpService } from 'smile-nestjs-got';
```

`HttpModule.register` / `registerAsync`, `global`, `extraProviders`, `axiosRef`, `request()` and the `HttpResponse.data/status/statusText` aliases all carry over. What changes is **got's request options and semantics** (not the NestJS glue):

| @nestjs/axios                 | smile-nestjs-got                              | Notes                                                                                             |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `baseURL`                     | `prefixUrl`                                   | got forbids a leading `/` on the path                                                             |
| `data` (body)                 | `json` / `body` / `form`                      | choose by content type                                                                            |
| `params`                      | `searchParams`                                |                                                                                                   |
| `timeout: 1000`               | `timeout: { request: 1000 }`                  | got uses granular timeouts                                                                        |
| `responseType: 'arraybuffer'` | `responseType: 'buffer'`                      | `blob` / `document` unsupported                                                                   |
| `axios.interceptors.*`        | `hooks.beforeRequest` / `hooks.afterResponse` | got hooks                                                                                         |
| `postForm(url, formData)`     | `post(url, { body: formData })`               | multipart — got's `form: {...}` is urlencoded only                                                |
| `AxiosError`                  | `HTTPError` / `RequestError`                  | `error.response` always set on `HTTPError`; may be `undefined` on `RequestError` (network errors) |

Example:

```ts
// Before (@nestjs/axios)
const { data } = await firstValueFrom(
  this.http.post<Cat>(
    '/cats',
    { name: 'Kitty' },
    {
      params: { q: 1 },
      headers: { authorization: `Bearer ${token}` },
    },
  ),
);

// After (smile-nestjs-got)
const { data } = await firstValueFrom(
  this.http.post<Cat>('cats', {
    json: { name: 'Kitty' },
    searchParams: { q: 1 },
    headers: { authorization: `Bearer ${token}` }, // unchanged
  }),
);
```

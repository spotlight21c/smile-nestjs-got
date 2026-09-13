# Migrating from `@nestjs/axios` to `smile-nestjs-got`

The **NestJS wiring stays identical** — module, service, injection tokens, and async registration all mirror `@nestjs/axios`. What changes is **got's request options and response shape**.

---

## Step 1 — Swap the import & install

```diff
- import { HttpModule, HttpService } from '@nestjs/axios';
+ import { HttpModule, HttpService } from 'smile-nestjs-got';
```

```bash
npm uninstall @nestjs/axios axios
npm i smile-nestjs-got got
```

Requires Node.js **>= 20.3** and got `^14 || ^15` (peer dependency). The package ships as CommonJS and loads the pure-ESM `got` via dynamic `import()`, so it works in both CommonJS and ESM NestJS apps with no build configuration.

`register` / `registerAsync` and the options-factory interface (`HttpModuleOptionsFactory` with `createHttpOptions()`) are unchanged — see [What carries over](#what-carries-over-unchanged). Only the option \_contents_change (Step 2).

---

## Step 2 — Update request options

This is the main per-call change:

```diff
- this.http.get('/cats', { params: { page: 1 }, timeout: 1000 });
+ this.http.get('cats',  { searchParams: { page: 1 }, timeout: { request: 1000 } });
```

### Request bodies

axios takes the body as the 2nd argument; got takes it inside the options:

```diff
- this.http.post('/cats', { name: 'Kitty' });                 // JSON
+ this.http.post('cats', { json: { name: 'Kitty' } });

- this.http.post('/login', qs.stringify({ user, pass }), {    // urlencoded
-   headers: { 'content-type': 'application/x-www-form-urlencoded' },
- });
+ this.http.post('login', { form: { user, pass } });

- this.http.postForm('/upload', formData);                    // multipart
+ this.http.post('upload', { body: formData });
```

> got's `form` option is **urlencoded plain objects only** — passing a
> `FormData` instance to it throws. A `FormData` instance goes in `body`
> (got sets the multipart content-type for you).

### `baseURL` → `prefixUrl`

got **forbids a leading `/`** on request paths used with `prefixUrl`:

```diff
- HttpModule.register({ baseURL: 'https://api.example.com' });
+ HttpModule.register({ prefixUrl: 'https://api.example.com' });

- this.http.get('/cats');
+ this.http.get('cats');
```

---

## Step 3 — Response access

The response carries axios-compatible aliases, so the most common reads —
`const { data } = await firstValueFrom(...)` — need **no change**:

| You used (axios)      | Still works (alias)      | got native                     |
| --------------------- | ------------------------ | ------------------------------ |
| `response.data`       | ✅ `response.data`       | `response.body`                |
| `response.status`     | ✅ `response.status`     | `response.statusCode`          |
| `response.statusText` | ✅ `response.statusText` | `response.statusMessage`       |
| `response.headers`    | —                        | `response.headers` (same)      |
| `response.config`     | ❌ not provided          | use `response.request.options` |

---

## Step 4 — Interceptors → hooks

There is no `interceptors` API; register got **hooks** in the module options:

```diff
- axiosInstance.interceptors.request.use((config) => {
-   config.headers.Authorization = `Bearer ${token}`;
-   return config;
- });
+ HttpModule.register({
+   hooks: {
+     beforeRequest: [
+       (options) => { options.headers.authorization = `Bearer ${token}`; },
+     ],
+   },
+ });
```

> Response/error interceptors map to `afterResponse` / `beforeError`; got also
> has `beforeRetry`, `beforeRedirect`, and `init`. See the
> [got hooks docs](https://github.com/sindresorhus/got/blob/main/documentation/9-hooks.md).

---

## Step 5 — Error handling

got throws `HTTPError` / `RequestError` instead of `AxiosError`. `error.response`
is always set on `HTTPError`, but may be `undefined` on `RequestError`
(network errors) — keep the guard:

```diff
  try {
    await firstValueFrom(this.http.get('cats'));
  } catch (e) {
-   if (e.response) console.log(e.response.status, e.response.data);
+   if (e.response) console.log(e.response.statusCode, e.response.body);
  }
```

> got throws on non-2xx by default (like axios); opt out with
> `throwHttpErrors: false`.

### Non-JSON success bodies

Methods default to `responseType: 'json'` (except `head`), and got parses
**strictly**: where axios silently fell back to the raw string, a non-empty
non-JSON 2xx body (e.g. a plain-text `OK` from a health check) throws a
`ParseError`. Empty 2xx bodies are fine — `''`, same as axios. Pass
`responseType: 'text'` for such endpoints:

```ts
this.http.post('jobs/1/restart', { responseType: 'text' });
```

---

## What carries over unchanged

- `HttpModule.register(...)` / `registerAsync(...)` with `useFactory` /
  `useClass` / `useExisting` / `inject` / `imports` / `extraProviders` / `global`
- Injecting `HttpService`, RxJS `Observable` returns, and the `request()` method
- `response.data` / `status` / `statusText` aliases, and `axiosRef`
  (alias of `gotRef` — the raw client instance)
- Cancellation: `signal` in the request options works the same, and
  unsubscribing from the Observable also aborts the request

---

## Quick reference

| `@nestjs/axios`                                  | `smile-nestjs-got`                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `baseURL`                                        | `prefixUrl` (no leading `/` on paths)                                    |
| `post(url, data)`                                | `post(url, { json: data })`                                              |
| `postForm(url, formData)`                        | `post(url, { body: formData })` (multipart; `form: {...}` is urlencoded) |
| `params`                                         | `searchParams`                                                           |
| `timeout: 1000`                                  | `timeout: { request: 1000 }`                                             |
| `responseType: 'arraybuffer'`                    | `responseType: 'buffer'` (`blob` / `document` unsupported)               |
| `axios.interceptors.request/response`            | `hooks.beforeRequest` / `hooks.afterResponse`                            |
| non-JSON 2xx body → raw string (silent fallback) | throws `ParseError` — pass `responseType: 'text'`                        |
| `AxiosError`                                     | `HTTPError` / `RequestError`                                             |

---

## What you gain

got's first-class APIs, exposed on `HttpService`:

```ts
// Streaming — a Duplex stream with upload/download progress events
// (axios offers `responseType: 'stream'`, but without progress reporting):
this.httpService.stream.get('large-file').pipe(res);

// Pagination — axios has no equivalent; you'd hand-roll the loop:
this.httpService.pagination.all<Item>('items'); // Observable<Item[]>
this.httpService.pagination.each<Item>('items'); // Observable<Item>
```

Plus built-in retries (axios needs the third-party `axios-retry` package),
HTTP/2, and RFC-compliant caching via the module options. See the
[got documentation](https://github.com/sindresorhus/got#documentation).

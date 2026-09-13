import { Inject, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import type {
  Got,
  OptionsOfBufferResponseBody,
  OptionsOfJSONResponseBody,
  OptionsOfTextResponseBody,
  OptionsOfUnknownResponseBody,
  Response,
} from './got.types';
import { GOT_INSTANCE_TOKEN } from './http.constants';
// Value imports on purpose: these classes are constructor-injected, so
// `emitDecoratorMetadata` needs them at runtime — `import type` breaks DI.
import { PaginationService } from './pagination.service';
import { StreamService } from './stream.service';

/**
 * A got `Response` augmented with axios-compatible aliases so that code
 * migrating from `@nestjs/axios` can keep reading `response.data` /
 * `response.status` / `response.statusText`. The native got properties
 * (`body`, `statusCode`, `statusMessage`, ...) remain available.
 */
export type HttpResponse<T = any> = Response<T> & {
  /** Alias for `body` — axios-compatible. */
  readonly data: T;
  /** Alias for `statusCode` — axios-compatible. */
  readonly status: number;
  /** Alias for `statusMessage` — axios-compatible. */
  readonly statusText: string;
};

/**
 * Per-request options selecting a plain-text body. `responseType: 'text'` is
 * required (unlike got's own optional literal) because this module defaults
 * to `'json'` — the explicit literal is what selects the text overload.
 */
export type TextResponseOptions = OptionsOfTextResponseBody & {
  responseType: 'text';
};

/**
 * Per-request options selecting a binary body (got returns a `Uint8Array`).
 */
export type BufferResponseOptions = OptionsOfBufferResponseBody & {
  responseType: 'buffer';
};

type RequestBodyOptions = OptionsOfJSONResponseBody | TextResponseOptions | BufferResponseOptions;

/**
 * Promise/Observable based HTTP client backed by `got`.
 *
 * The API mirrors `@nestjs/axios`'s `HttpService` (same injection token name,
 * `axiosRef`, `request()` and `head/get/post/put/patch/delete`). got's
 * streaming and pagination APIs are additionally exposed through the `stream`
 * and `pagination` members.
 */
@Injectable()
export class HttpService {
  constructor(
    readonly stream: StreamService,
    readonly pagination: PaginationService,
    @Inject(GOT_INSTANCE_TOKEN) protected readonly instance: Got,
  ) {}

  request<T = any>(options: OptionsOfJSONResponseBody & { url: string | URL }): Observable<HttpResponse<T>>;
  request(options: TextResponseOptions & { url: string | URL }): Observable<HttpResponse<string>>;
  request(options: BufferResponseOptions & { url: string | URL }): Observable<HttpResponse<Uint8Array>>;
  request<T = any>(options: RequestBodyOptions & { url: string | URL }): Observable<HttpResponse<T>> {
    const { url, ...rest } = options;
    return this.makeObservable<T>(
      (signal) =>
        this.instance<T>(url, {
          responseType: 'json',
          ...rest,
          signal,
        } as OptionsOfJSONResponseBody) as unknown as Promise<Response<T>>,
      rest.signal,
    );
  }

  /**
   * HEAD responses have no body, so unlike the other methods no JSON default
   * is applied and the body is typed as got's default: an (empty) string.
   */
  head(url: string | URL, options?: OptionsOfUnknownResponseBody): Observable<HttpResponse<string>> {
    return this.makeObservable<string>(
      (signal) => this.instance.head(url, { ...options, signal }) as unknown as Promise<Response<string>>,
      options?.signal,
    );
  }

  get<T = any>(url: string | URL, options?: OptionsOfJSONResponseBody): Observable<HttpResponse<T>>;
  get(url: string | URL, options: TextResponseOptions): Observable<HttpResponse<string>>;
  get(url: string | URL, options: BufferResponseOptions): Observable<HttpResponse<Uint8Array>>;
  get<T = any>(url: string | URL, options?: RequestBodyOptions): Observable<HttpResponse<T>> {
    return this.makeObservable<T>(
      (signal) =>
        this.instance.get<T>(url, {
          responseType: 'json',
          ...options,
          signal,
        } as OptionsOfJSONResponseBody),
      options?.signal,
    );
  }

  post<T = any>(url: string | URL, options?: OptionsOfJSONResponseBody): Observable<HttpResponse<T>>;
  post(url: string | URL, options: TextResponseOptions): Observable<HttpResponse<string>>;
  post(url: string | URL, options: BufferResponseOptions): Observable<HttpResponse<Uint8Array>>;
  post<T = any>(url: string | URL, options?: RequestBodyOptions): Observable<HttpResponse<T>> {
    return this.makeObservable<T>(
      (signal) =>
        this.instance.post<T>(url, {
          responseType: 'json',
          ...options,
          signal,
        } as OptionsOfJSONResponseBody),
      options?.signal,
    );
  }

  put<T = any>(url: string | URL, options?: OptionsOfJSONResponseBody): Observable<HttpResponse<T>>;
  put(url: string | URL, options: TextResponseOptions): Observable<HttpResponse<string>>;
  put(url: string | URL, options: BufferResponseOptions): Observable<HttpResponse<Uint8Array>>;
  put<T = any>(url: string | URL, options?: RequestBodyOptions): Observable<HttpResponse<T>> {
    return this.makeObservable<T>(
      (signal) =>
        this.instance.put<T>(url, {
          responseType: 'json',
          ...options,
          signal,
        } as OptionsOfJSONResponseBody),
      options?.signal,
    );
  }

  patch<T = any>(url: string | URL, options?: OptionsOfJSONResponseBody): Observable<HttpResponse<T>>;
  patch(url: string | URL, options: TextResponseOptions): Observable<HttpResponse<string>>;
  patch(url: string | URL, options: BufferResponseOptions): Observable<HttpResponse<Uint8Array>>;
  patch<T = any>(url: string | URL, options?: RequestBodyOptions): Observable<HttpResponse<T>> {
    return this.makeObservable<T>(
      (signal) =>
        this.instance.patch<T>(url, {
          responseType: 'json',
          ...options,
          signal,
        } as OptionsOfJSONResponseBody),
      options?.signal,
    );
  }

  delete<T = any>(url: string | URL, options?: OptionsOfJSONResponseBody): Observable<HttpResponse<T>>;
  delete(url: string | URL, options: TextResponseOptions): Observable<HttpResponse<string>>;
  delete(url: string | URL, options: BufferResponseOptions): Observable<HttpResponse<Uint8Array>>;
  delete<T = any>(url: string | URL, options?: RequestBodyOptions): Observable<HttpResponse<T>> {
    return this.makeObservable<T>(
      (signal) =>
        this.instance.delete<T>(url, {
          responseType: 'json',
          ...options,
          signal,
        } as OptionsOfJSONResponseBody),
      options?.signal,
    );
  }

  /**
   * The underlying got instance. `gotRef` is the canonical name; `axiosRef` is
   * provided as an alias for `@nestjs/axios` compatibility.
   */
  get gotRef(): Got {
    return this.instance;
  }

  get axiosRef(): Got {
    return this.instance;
  }

  /**
   * Wraps a got request into a cold Observable. Unsubscribing aborts the
   * request via an internal AbortController; a caller-provided signal is
   * merged in (not replaced) so both can abort. Only unsubscribe-driven
   * aborts are swallowed — an abort from the caller's signal surfaces as an
   * error, matching axios cancel semantics.
   */
  protected makeObservable<T>(
    factory: (signal: AbortSignal) => Promise<Response<T>>,
    userSignal?: AbortSignal,
  ): Observable<HttpResponse<T>> {
    return new Observable<HttpResponse<T>>((subscriber) => {
      const controller = new AbortController();
      const signal = userSignal ? AbortSignal.any([controller.signal, userSignal]) : controller.signal;

      factory(signal)
        .then((response) => {
          subscriber.next(this.toCompatResponse<T>(response));
          subscriber.complete();
        })
        .catch((error) => {
          // Aborting after unsubscribe surfaces as a rejection we can ignore.
          if (!controller.signal.aborted) {
            subscriber.error(error);
          }
        });

      return () => controller.abort();
    });
  }

  private toCompatResponse<T>(response: Response<T>): HttpResponse<T> {
    return Object.defineProperties(response, {
      data: {
        get: () => response.body,
        enumerable: false,
        configurable: true,
      },
      status: {
        get: () => response.statusCode,
        enumerable: false,
        configurable: true,
      },
      statusText: {
        get: () => response.statusMessage,
        enumerable: false,
        configurable: true,
      },
    }) as unknown as HttpResponse<T>;
  }
}

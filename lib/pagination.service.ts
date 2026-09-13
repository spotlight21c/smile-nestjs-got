import { Inject, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Got, OptionsWithPagination } from './got.types';
import { GOT_INSTANCE_TOKEN } from './http.constants';

function mergeSignals(internal: AbortSignal, user?: AbortSignal): AbortSignal {
  return user ? AbortSignal.any([internal, user]) : internal;
}

@Injectable()
export class PaginationService {
  constructor(@Inject(GOT_INSTANCE_TOKEN) protected readonly instance: Got) {}

  /**
   * Emits every item across all pages individually, then completes.
   * Mirrors `got.paginate.each`.
   */
  each<T = any, R = unknown>(url: string | URL, options?: OptionsWithPagination<T, R>): Observable<T> {
    return new Observable<T>((subscriber) => {
      const controller = new AbortController();
      const iterator = this.instance.paginate.each<T, R>(url, {
        ...options,
        signal: mergeSignals(controller.signal, options?.signal),
      } as OptionsWithPagination<T, R>);

      (async () => {
        try {
          for await (const item of iterator) {
            if (controller.signal.aborted) {
              return;
            }
            subscriber.next(item);
          }
          subscriber.complete();
        } catch (error) {
          if (!controller.signal.aborted) {
            subscriber.error(error);
          }
        }
      })();

      return () => controller.abort();
    });
  }

  /**
   * Emits a single array containing every item across all pages, then completes.
   * Mirrors `got.paginate.all`.
   */
  all<T = any, R = unknown>(url: string | URL, options?: OptionsWithPagination<T, R>): Observable<T[]> {
    return new Observable<T[]>((subscriber) => {
      const controller = new AbortController();
      const request = this.instance.paginate.all<T, R>(url, {
        ...options,
        signal: mergeSignals(controller.signal, options?.signal),
      } as OptionsWithPagination<T, R>);

      request
        .then((items) => {
          subscriber.next(items);
          subscriber.complete();
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            subscriber.error(error);
          }
        });

      return () => controller.abort();
    });
  }
}

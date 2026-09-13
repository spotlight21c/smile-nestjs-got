import { Inject, Injectable } from '@nestjs/common';
import type { Got, Request, StreamOptions } from './got.types';
import { GOT_INSTANCE_TOKEN } from './http.constants';

@Injectable()
export class StreamService {
  constructor(@Inject(GOT_INSTANCE_TOKEN) protected readonly instance: Got) {}

  get(url: string | URL, options?: StreamOptions): Request {
    return this.instance.stream.get(url, options);
  }

  head(url: string | URL, options?: StreamOptions): Request {
    return this.instance.stream.head(url, options);
  }

  post(url: string | URL, options?: StreamOptions): Request {
    return this.instance.stream.post(url, options);
  }

  put(url: string | URL, options?: StreamOptions): Request {
    return this.instance.stream.put(url, options);
  }

  patch(url: string | URL, options?: StreamOptions): Request {
    return this.instance.stream.patch(url, options);
  }

  delete(url: string | URL, options?: StreamOptions): Request {
    return this.instance.stream.delete(url, options);
  }
}

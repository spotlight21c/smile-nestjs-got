import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { firstValueFrom, lastValueFrom, toArray } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpModule } from '../lib/http.module';
import { HttpService } from '../lib/http.service';
import type { HttpModuleOptions, HttpModuleOptionsFactory } from '../lib/interfaces';
import { PaginationService } from '../lib/pagination.service';
import { StreamService } from '../lib/stream.service';

describe('HttpModule (e2e)', () => {
  let server: Server;
  let baseUrl: string;
  let http: HttpService;
  // Hooks the /slow endpoint reports into, re-armed per test.
  let onSlowRequest: (() => void) | undefined;
  let onSlowClosed: (() => void) | undefined;

  beforeAll(async () => {
    // Minimal server: /json returns an object, /page/N returns a list page
    // with a Link header pointing at the next page (for pagination tests).
    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');

      if (url.pathname === '/json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ hello: 'world', method: req.method }));
        return;
      }

      const pageMatch = url.pathname.match(/^\/page\/(\d+)$/);
      if (pageMatch) {
        const page = Number(pageMatch[1]);
        res.setHeader('content-type', 'application/json');
        if (page < 3) {
          res.setHeader('link', `<${baseUrl}/page/${page + 1}>; rel="next"`);
        }
        res.end(JSON.stringify([page * 10, page * 10 + 1]));
        return;
      }

      if (url.pathname === '/stream') {
        res.setHeader('content-type', 'text/plain');
        res.end('streamed-body');
        return;
      }

      if (url.pathname === '/echo-headers') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(req.headers));
        return;
      }

      // Never responds — used to observe client-side aborts server-side.
      if (url.pathname === '/slow') {
        onSlowRequest?.();
        res.on('close', () => onSlowClosed?.());
        return;
      }

      res.statusCode = 404;
      res.end('not found');
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;

    const moduleRef = await Test.createTestingModule({
      imports: [HttpModule.register({})],
    }).compile();

    http = moduleRef.get(HttpService);
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('injects HttpService with stream and pagination members', () => {
    expect(http).toBeInstanceOf(HttpService);
    expect(http.stream).toBeDefined();
    expect(http.pagination).toBeDefined();
    expect(http.gotRef).toBeDefined();
    expect(http.axiosRef).toBe(http.gotRef);
  });

  it('performs a GET and parses JSON into an Observable', async () => {
    const response = await firstValueFrom(http.get<{ hello: string; method: string }>(`${baseUrl}/json`));
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ hello: 'world', method: 'GET' });
  });

  it('exposes axios-compatible response aliases (data/status/statusText)', async () => {
    const response = await firstValueFrom(http.get<{ hello: string }>(`${baseUrl}/json`));
    expect(response.data).toEqual(response.body);
    expect(response.status).toBe(response.statusCode);
    expect(response.statusText).toBe(response.statusMessage);
  });

  it('supports the axios-style request() method', async () => {
    const response = await firstValueFrom(http.request<{ hello: string }>({ url: `${baseUrl}/json` }));
    expect(response.data).toEqual({ hello: 'world', method: 'GET' });
  });

  it('paginates across pages with pagination.all', async () => {
    const items = await firstValueFrom(http.pagination.all<number>(`${baseUrl}/page/1`));
    expect(items).toEqual([10, 11, 20, 21, 30, 31]);
  });

  it('paginates item-by-item with pagination.each', async () => {
    const items = await lastValueFrom(http.pagination.each<number>(`${baseUrl}/page/1`).pipe(toArray()));
    expect(items).toEqual([10, 11, 20, 21, 30, 31]);
  });

  it('exposes a raw got stream that can be consumed', async () => {
    const chunks: Buffer[] = [];
    const stream = http.stream.get(`${baseUrl}/stream`);
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    expect(Buffer.concat(chunks).toString()).toBe('streamed-body');
  });

  it('performs a HEAD request without trying to JSON-parse the empty body', async () => {
    const response = await firstValueFrom(http.head(`${baseUrl}/json`));
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('');
  });

  it('lets per-request options override the JSON default (text)', async () => {
    // No cast needed: the text overload types response.body as string.
    const response = await firstValueFrom(http.get(`${baseUrl}/json`, { responseType: 'text' }));
    expect(typeof response.body).toBe('string');
    expect(JSON.parse(response.body)).toEqual({
      hello: 'world',
      method: 'GET',
    });
  });

  it('lets per-request options override the JSON default (buffer)', async () => {
    const response = await firstValueFrom(http.get(`${baseUrl}/json`, { responseType: 'buffer' }));
    expect(response.body).toBeInstanceOf(Uint8Array);
    expect(JSON.parse(Buffer.from(response.body).toString())).toEqual({
      hello: 'world',
      method: 'GET',
    });
  });

  it('propagates HTTP errors with the response attached', async () => {
    const error = await firstValueFrom(http.get(`${baseUrl}/missing`)).then(
      () => {
        throw new Error('expected the request to fail');
      },
      (e) => e,
    );
    expect(error.constructor.name).toBe('HTTPError');
    expect(error.response.statusCode).toBe(404);
  });

  it('supports registerAsync with useFactory', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        HttpModule.registerAsync({
          useFactory: () => ({ headers: { 'x-test': 'async' } }),
        }),
      ],
    }).compile();

    const asyncHttp = moduleRef.get(HttpService);
    const response = await firstValueFrom(asyncHttp.get<Record<string, string>>(`${baseUrl}/echo-headers`));
    expect(response.body['x-test']).toBe('async');
  });

  it('supports registerAsync with useClass', async () => {
    class OptionsFactory implements HttpModuleOptionsFactory {
      createHttpOptions(): HttpModuleOptions {
        return { headers: { 'x-test': 'use-class' } };
      }
    }

    const moduleRef = await Test.createTestingModule({
      imports: [HttpModule.registerAsync({ useClass: OptionsFactory })],
    }).compile();

    const classHttp = moduleRef.get(HttpService);
    const response = await firstValueFrom(classHttp.get<Record<string, string>>(`${baseUrl}/echo-headers`));
    expect(response.body['x-test']).toBe('use-class');
  });

  it('exports StreamService and PaginationService for direct injection', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HttpModule.register({})],
    }).compile();

    expect(moduleRef.get(StreamService)).toBeInstanceOf(StreamService);
    expect(moduleRef.get(PaginationService)).toBeInstanceOf(PaginationService);
  });

  it('aborts the in-flight request when the subscription is torn down', async () => {
    const requestReceived = new Promise<void>((r) => (onSlowRequest = r));
    const connectionClosed = new Promise<void>((r) => (onSlowClosed = r));

    const subscription = http.get(`${baseUrl}/slow`).subscribe({
      error: () => {
        // ignore — aborting is expected to reject internally
      },
    });
    await requestReceived;
    subscription.unsubscribe();

    // The server must observe the connection closing — a real abort.
    await connectionClosed;
    expect(subscription.closed).toBe(true);
  });

  it('respects a caller-provided AbortSignal and surfaces the abort as an error', async () => {
    const requestReceived = new Promise<void>((r) => (onSlowRequest = r));
    const controller = new AbortController();

    const promise = firstValueFrom(http.get(`${baseUrl}/slow`, { signal: controller.signal }));
    await requestReceived;
    controller.abort();

    await expect(promise).rejects.toThrow();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

/**
 * public/sw.js is plain browser script, so these tests run it in a sandbox with
 * a small fake of the worker globals (caches, fetch, events) and drive its
 * handlers directly.
 */
type Handler = (event: Record<string, unknown>) => void;

function makeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  const key = (req: Request | string) =>
    typeof req === 'string' ? req : new URL(req.url).pathname + new URL(req.url).search;
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      addAll: async (urls: string[]) => {
        for (const u of urls) store.set(u, new Response(`precached ${u}`));
      },
      put: async (req: Request | string, res: Response) => void store.set(key(req), res),
    };
  };
  return {
    stores,
    api: {
      open,
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
      match: async (req: Request | string) => {
        for (const store of stores.values()) {
          const hit = store.get(key(req));
          if (hit) return hit.clone();
        }
        return undefined;
      },
    },
  };
}

function loadWorker(fetchImpl: (req: Request) => Promise<Response>) {
  const source = fs.readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf8');
  const listeners: Record<string, Handler> = {};
  const c = makeCaches();
  const self = {
    location: { origin: 'https://app.test' },
    addEventListener: (type: string, fn: Handler) => void (listeners[type] = fn),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  vm.runInNewContext(source, {
    self,
    caches: c.api,
    fetch: fetchImpl,
    URL,
    Response,
    Promise,
  });
  const dispatch = async (type: string, extra: Record<string, unknown> = {}) => {
    let responded: Promise<Response> | undefined;
    let waited: Promise<unknown> | undefined;
    listeners[type]({
      ...extra,
      respondWith: (p: Promise<Response>) => void (responded = p),
      waitUntil: (p: Promise<unknown>) => void (waited = p),
    });
    if (waited) await waited;
    return responded ? await responded : undefined;
  };
  return { dispatch, caches: c };
}

function req(url: string, init: { mode?: string; method?: string } = {}) {
  const r = new Request(`https://app.test${url}`, { method: init.method ?? 'GET' });
  if (init.mode) Object.defineProperty(r, 'mode', { value: init.mode });
  return r;
}

// A same-origin fetch in a browser resolves to a "basic" response; a hand-built
// Response reports "default", so mark it the way the browser would.
function basic(res: Response, init: { redirected?: boolean } = {}) {
  Object.defineProperty(res, 'type', { value: 'basic' });
  if (init.redirected) Object.defineProperty(res, 'redirected', { value: true });
  return res;
}

let online = true;
const network = async (r: Request) => {
  if (!online) throw new TypeError('offline');
  return basic(new Response(`live ${new URL(r.url).pathname}`));
};

beforeEach(() => {
  online = true;
});

describe('service worker', () => {
  it('saves the offline page and icons when it installs', async () => {
    const sw = loadWorker(network);
    await sw.dispatch('install');
    const shell = [...sw.caches.stores.get('ss-shell-v1')!.keys()];
    expect(shell).toEqual(['/offline.html', '/icon.svg', '/icons/icon-192x192.png']);
  });

  it("removes caches from older versions when it activates, and no one else's", async () => {
    const sw = loadWorker(network);
    await sw.caches.api.open('ss-pages-v0');
    await sw.caches.api.open('unrelated');
    await sw.dispatch('activate');
    expect(await sw.caches.api.keys()).toEqual(['unrelated']);
  });

  it('serves a page live when online, and from its last copy when offline', async () => {
    const sw = loadWorker(network);
    await sw.dispatch('install');
    const live = await sw.dispatch('fetch', { request: req('/dashboard', { mode: 'navigate' }) });
    expect(await live!.text()).toBe('live /dashboard');
    await Promise.resolve(); // let the background cache write settle
    await new Promise((r) => setTimeout(r, 0));

    online = false;
    const offline = await sw.dispatch('fetch', {
      request: req('/dashboard', { mode: 'navigate' }),
    });
    expect(await offline!.text()).toBe('live /dashboard');
  });

  it('falls back to the offline page for a page it has never seen', async () => {
    const sw = loadWorker(network);
    await sw.dispatch('install');
    online = false;
    const res = await sw.dispatch('fetch', { request: req('/tasks', { mode: 'navigate' }) });
    expect(await res!.text()).toBe('precached /offline.html');
  });

  it('keeps hashed build files after the first load', async () => {
    const sw = loadWorker(network);
    await sw.dispatch('fetch', { request: req('/_next/static/chunks/app.abc123.js') });
    await new Promise((r) => setTimeout(r, 0));
    online = false;
    const res = await sw.dispatch('fetch', { request: req('/_next/static/chunks/app.abc123.js') });
    expect(await res!.text()).toBe('live /_next/static/chunks/app.abc123.js');
  });

  it('does not touch API calls, other origins, or anything but GET', async () => {
    const sw = loadWorker(network);
    expect(await sw.dispatch('fetch', { request: req('/api/syllabus/extract') })).toBeUndefined();
    expect(
      await sw.dispatch('fetch', {
        request: new Request('https://firestore.googleapis.com/v1/projects/x'),
      }),
    ).toBeUndefined();
    expect(
      await sw.dispatch('fetch', {
        request: req('/dashboard', { mode: 'navigate', method: 'POST' }),
      }),
    ).toBeUndefined();
  });

  it('does not keep an error page', async () => {
    const sw = loadWorker(async () => basic(new Response('nope', { status: 500 })));
    await sw.dispatch('fetch', { request: req('/dashboard', { mode: 'navigate' }) });
    await new Promise((r) => setTimeout(r, 0));
    expect(sw.caches.stores.get('ss-pages-v1')?.size ?? 0).toBe(0);
  });

  it('does not keep a redirect, which could not be replayed to a navigation', async () => {
    const sw = loadWorker(async () =>
      basic(new Response('moved', { status: 200 }), { redirected: true }),
    );
    await sw.dispatch('fetch', { request: req('/', { mode: 'navigate' }) });
    await new Promise((r) => setTimeout(r, 0));
    expect(sw.caches.stores.get('ss-pages-v1')?.size ?? 0).toBe(0);
  });
});

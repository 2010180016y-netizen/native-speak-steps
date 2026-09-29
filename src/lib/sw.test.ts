import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Runs public/sw.js against an in-memory Cache Storage and a scripted network.

const ORIGIN = "https://app.test";
const source = readFileSync(path.resolve(process.cwd(), "public/sw.js"), "utf8");

type Input = string | { url: string };
const keyOf = (input: Input) => new URL(typeof input === "string" ? input : input.url, ORIGIN).href;

// Real hosts answer with "Vary: Origin"; the fake cache below honours it unless told not to.
const html = (body: string, init: ResponseInit = {}) =>
  new Response(body, { ...init, headers: { "content-type": "text/html; charset=utf-8", vary: "Origin" } });
const script = (body: string) => new Response(body, { headers: { "content-type": "text/javascript", vary: "Origin" } });
const page = (...assets: string[]) => html(`<html>${assets.map((a) => `<script type="module" src="${a}"></script>`).join("")}</html>`);

type Handler = (event: {
  request?: { url: string; method: string; mode: string };
  waitUntil(promise: Promise<unknown>): void;
  respondWith(response: Promise<Response>): void;
}) => void;

let stores: Map<string, Map<string, Response>>;
let network: Record<string, () => Response | Promise<Response>>;
let fetchFake: ReturnType<typeof vi.fn>;
let selfFake: { skipWaiting: ReturnType<typeof vi.fn>; clients: { claim: ReturnType<typeof vi.fn> } };
let handlers: Record<string, Handler>;

beforeEach(() => {
  stores = new Map();
  network = {};
  fetchFake = vi.fn(async (input: Input) => {
    const respond = network[keyOf(input)];
    if (!respond) throw new TypeError("offline");
    return respond();
  });
  const caches = {
    open: async (name: string) => {
      const store = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, store);
      return {
        match: async (input: Input, options?: { ignoreVary?: boolean }) => {
          const response = store.get(keyOf(input));
          // A lookup from another request (the page's own) never satisfies "Vary: Origin".
          return response?.headers.get("vary") && !options?.ignoreVary ? undefined : response?.clone();
        },
        put: async (input: Input, response: Response) => {
          store.delete(keyOf(input));
          store.set(keyOf(input), response.clone());
        },
        keys: async () => [...store.keys()].map((url) => ({ url })),
        delete: async (input: Input) => store.delete(keyOf(input)),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  handlers = {};
  selfFake = { skipWaiting: vi.fn(), clients: { claim: vi.fn(async () => {}) } };
  new Function("self", "caches", "fetch", source)(
    {
      ...selfFake,
      location: { origin: ORIGIN },
      addEventListener: (type: string, handler: Handler) => (handlers[type] = handler),
    },
    caches,
    fetchFake,
  );
});

afterEach(() => vi.useRealTimers());

/** Fires an event and resolves to what the worker answered (undefined: it let the request pass). */
async function dispatch(type: string, request?: { url: string; method?: string; mode?: string }) {
  const waits: Promise<unknown>[] = [];
  let answer: Promise<Response> | undefined;
  handlers[type]({
    request: request && { method: "GET", mode: "cors", ...request },
    waitUntil: (promise) => waits.push(promise),
    respondWith: (response) => (answer = response),
  });
  const response = await answer;
  await Promise.all(waits);
  return response;
}

const navigate = (pathname: string) => dispatch("fetch", { url: `${ORIGIN}${pathname}`, mode: "navigate" });
const stored = (cache: string) => [...(stores.get(cache)?.keys() ?? [])].map((url) => url.replace(ORIGIN, ""));
const shellText = async () => stores.get("shell-v1")?.get(`${ORIGIN}/`)?.text();

describe("install", () => {
  it("caches the shell and the files it references, and takes over at once", async () => {
    network["https://app.test/"] = () => page("/assets/index-a.js", "/assets/index-a.css");
    network["https://app.test/assets/index-a.js"] = () => script("a");
    network["https://app.test/assets/index-a.css"] = () => new Response("a", { headers: { "content-type": "text/css" } });

    await dispatch("install");

    expect(stored("shell-v1")).toEqual(["/"]);
    expect(stored("assets-v1")).toEqual(["/assets/index-a.js", "/assets/index-a.css"]);
    expect(selfFake.skipWaiting).toHaveBeenCalled();
  });

  it("still installs when the download fails", async () => {
    await expect(dispatch("install")).resolves.toBeUndefined();
    expect(stored("shell-v1")).toEqual([]);
  });
});

describe("pages", () => {
  it("serve the network and refresh the shell with the new build's files", async () => {
    network["https://app.test/dashboard"] = () => page("/assets/index-b.js");
    network["https://app.test/assets/index-b.js"] = () => script("b");

    const response = await navigate("/dashboard");

    expect(await response?.text()).toContain("index-b.js");
    expect(await shellText()).toContain("index-b.js");
    expect(stored("assets-v1")).toEqual(["/assets/index-b.js"]);
  });

  it("fall back to the cached shell offline, whichever route was asked for", async () => {
    network["https://app.test/"] = () => page("/assets/index-a.js");
    network["https://app.test/assets/index-a.js"] = () => script("a");
    await dispatch("install");
    network = {};

    expect(await (await navigate("/cards"))?.text()).toContain("index-a.js");
  });

  it("fail like a normal offline page when nothing is cached", async () => {
    expect((await navigate("/cards"))?.type).toBe("error");
  });

  it("fall back to the shell when the network takes over 4 seconds", async () => {
    vi.useFakeTimers();
    network["https://app.test/"] = () => page("/assets/index-a.js");
    network["https://app.test/assets/index-a.js"] = () => script("a");
    await dispatch("install");
    network["https://app.test/cards"] = () => new Promise<Response>(() => {});

    const answer = navigate("/cards");
    await vi.advanceTimersByTimeAsync(4000);

    expect(await (await answer)?.text()).toContain("index-a.js");
  });

  it("are not stored as the shell unless they are a good HTML page", async () => {
    network["https://app.test/missing"] = () => html("not found", { status: 404 });
    network["https://app.test/robots.txt"] = () => new Response("User-agent: *", { headers: { "content-type": "text/plain" } });
    network["https://app.test/moved"] = () => {
      const response = html("moved");
      Object.defineProperty(response, "redirected", { value: true });
      return response;
    };

    for (const pathname of ["/missing", "/robots.txt", "/moved"]) await navigate(pathname);

    expect(stored("shell-v1")).toEqual([]);
  });
});

describe("build files", () => {
  it("are served from the cache once fetched", async () => {
    network["https://app.test/assets/chunk-1.js"] = () => script("one");
    const request = { url: `${ORIGIN}/assets/chunk-1.js` };

    await dispatch("fetch", request);
    network = {};

    expect(await (await dispatch("fetch", request))?.text()).toBe("one");
    expect(fetchFake).toHaveBeenCalledTimes(1);
  });

  it("are not cached when the host answers with the HTML shell instead", async () => {
    network["https://app.test/assets/gone.js"] = () => html("<html></html>");

    const response = await dispatch("fetch", { url: `${ORIGIN}/assets/gone.js` });

    expect(await response?.text()).toBe("<html></html>");
    expect(stored("assets-v1")).toEqual([]);
  });

  it("keep only the newest 150", async () => {
    for (let i = 0; i < 152; i++) {
      network[`https://app.test/assets/f${i}.js`] = () => script(String(i));
      await dispatch("fetch", { url: `${ORIGIN}/assets/f${i}.js` });
    }

    const files = stored("assets-v1");
    expect(files).toHaveLength(150);
    expect(files[0]).toBe("/assets/f2.js");
  });
});

describe("requests it leaves alone", () => {
  it.each([
    ["another origin", { url: "https://api.test/assets/x.js" }],
    ["a non-GET request", { url: `${ORIGIN}/assets/x.js`, method: "POST" }],
    ["other same-origin files", { url: `${ORIGIN}/icon-192.png` }],
  ])("%s", async (_name, request) => {
    expect(await dispatch("fetch", request)).toBeUndefined();
  });
});

describe("activate", () => {
  it("deletes caches from other versions and claims the open pages", async () => {
    stores.set("shell-v0", new Map());
    stores.set("assets-v1", new Map());

    await dispatch("activate");

    expect([...stores.keys()]).toEqual(["assets-v1"]);
    expect(selfFake.clients.claim).toHaveBeenCalled();
  });
});

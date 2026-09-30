// Offline app shell (PLT-2) and study reminders (PRD-3).
//
// - Pages: network first, so a new deploy shows on the next visit. When the network fails or takes
//   more than 4 seconds, the last shell is served. Every route is the same index.html, kept as "/".
// - Build files under /assets/ carry a hash in their name and never change, so they are cached
//   first. The files a page references are cached as soon as it loads, so the app also starts
//   offline after a deploy. Route chunks are cached when first used: offline you get the screens
//   you have opened (the app's data still needs a connection).
// - Only same-origin GET requests are handled: Supabase, Toss and everything else pass through.

const SHELL_CACHE = "shell-v1";
const ASSET_CACHE = "assets-v1";
const MAX_ASSETS = 150; // a build has about 50 files; older builds' files age out
const NETWORK_TIMEOUT_MS = 4000;

// Hosts often answer with "Vary: Origin". The page's script requests and this worker's own fetch
// differ in that header, so a plain lookup misses the file that was just cached. Cached files are
// the same for every request to their URL, so the header must not take part in matching.
const MATCH = { ignoreVary: true };

const isHtml = (response) => (response.headers.get("content-type") || "").includes("text/html");
// A missing file is often answered with index.html (status 200): never store that as a script.
const cacheable = (response, html) =>
  response.ok && !response.redirected && (html ? isHtml(response) : !isHtml(response));

async function prune(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((key) => cache.delete(key)));
}

/** Stores a page as the shell, and the build files it references that are not cached yet. */
async function cacheShell(response) {
  const html = await response.clone().text();
  await (await caches.open(SHELL_CACHE)).put("/", response);

  const assets = await caches.open(ASSET_CACHE);
  const urls = [...new Set(html.match(/\/assets\/[^"')\s]+/g) || [])];
  await Promise.all(
    urls.map(async (url) => {
      if (await assets.match(url, MATCH)) return;
      const file = await fetch(url);
      if (cacheable(file, false)) await assets.put(url, file);
    }),
  );
  await prune(assets);
}

async function page(event) {
  try {
    const response = await Promise.race([
      fetch(event.request),
      new Promise((_, reject) => setTimeout(reject, NETWORK_TIMEOUT_MS)),
    ]);
    if (cacheable(response, true)) event.waitUntil(cacheShell(response.clone()).catch(() => {}));
    return response;
  } catch {
    const shell = await (await caches.open(SHELL_CACHE)).match("/", MATCH);
    return shell || Response.error();
  }
}

async function asset(event) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(event.request, MATCH);
  if (cached) return cached;

  const response = await fetch(event.request);
  if (cacheable(response, false)) {
    event.waitUntil(cache.put(event.request, response.clone()).then(() => prune(cache)));
  }
  return response;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // A failed download must not stop the worker from installing: reminders depend on it.
  event.waitUntil(
    fetch("/", { cache: "reload" })
      .then((response) => (cacheable(response, true) ? cacheShell(response) : undefined))
      .catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== SHELL_CACHE && name !== ASSET_CACHE).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") event.respondWith(page(event));
  else if (url.pathname.startsWith("/assets/")) event.respondWith(asset(event));
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "LangSync", {
      body: data.body,
      icon: "/icon-192.png",
      data: { url: data.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.url));
});

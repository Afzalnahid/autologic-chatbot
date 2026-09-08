/* getvoicium push service worker.
   Shows a notification when the server sends a push (new order, new booking, a
   chat that needs a human) even while the dashboard is closed, and opens the
   right tab when the owner taps it. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || "getvoicium";
  const options = {
    body: data.body || "",
    icon: "/logo.png",
    badge: "/logo.png",
    tag: data.tag || undefined,          // same tag replaces an older one instead of stacking
    renotify: !!data.tag,
    data: { url: data.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  // The dashboard is a single page with hash tabs (#orders, #conversations …).
  // The tab is the hash; the app switches to it.
  const tab = (url.split("#")[1] || "");
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Focus an already-open dashboard tab if there is one; otherwise open a new one.
    for (const w of wins) {
      if (w.url.includes("/dashboard") && "focus" in w) {
        await w.focus();
        // Two ways to reach the right tab, because a hash-only navigation does
        // not reload the app (so the app would stay on whatever tab it was on):
        //   1. tell the running app directly which tab to open, and
        //   2. still change the address bar so a reload lands there too.
        if (tab) { try { w.postMessage({ type: "gv-navigate", tab, url }); } catch (e) { /* no channel */ } }
        if ("navigate" in w) { try { await w.navigate(url); } catch (e) { /* cross-origin/uncontrolled guard */ } }
        return;
      }
    }
    // No dashboard open — a fresh window at the url reads the hash on load.
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});

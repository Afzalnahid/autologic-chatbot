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
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Focus an already-open dashboard tab if there is one; otherwise open a new one.
    for (const w of wins) {
      if (w.url.includes("/dashboard") && "focus" in w) {
        await w.focus();
        if ("navigate" in w) { try { await w.navigate(url); } catch (e) { /* cross-origin guard */ } }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});

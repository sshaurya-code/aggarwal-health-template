// Shows reminder pushes and opens the right page when one is tapped.
self.addEventListener("push", (event) => {
  const msg = event.data ? event.data.json() : { title: "Family", body: "", url: "/" };
  event.waitUntil(self.registration.showNotification(msg.title, { body: msg.body, icon: "/apple-icon", data: { url: msg.url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url ?? "/"));
});

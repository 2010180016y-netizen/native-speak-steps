import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** Web push works in this browser and the app is configured for it. (iOS: only once added to the Home Screen.) */
export const pushSupported = () =>
  Boolean(VAPID_PUBLIC_KEY) && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function base64UrlToBytes(value: string) {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Asks for notification permission and stores this browser's push subscription. */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported() || (await Notification.requestPermission()) !== "granted") return false;
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY!),
  });
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys?.auth) return false;
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" });
  return !error;
}

/** Removes this browser's push subscription, if any. */
export async function disablePush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}

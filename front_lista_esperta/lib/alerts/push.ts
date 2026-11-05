"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";

/**
 * unsupported: browser without Web Push (or iOS outside the installed app);
 * no-worker: the service worker is not running (dev without NEXT_PUBLIC_ENABLE_SW_IN_DEV);
 * off: no key on the server; denied: the person blocked notifications.
 */
export type PushStatus = "checking" | "unsupported" | "no-worker" | "off" | "denied" | "ready" | "subscribed";

/** VAPID keys are base64url; PushManager wants the raw bytes. */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  return navigator.serviceWorker.getRegistration("/");
}

/** What this browser can do with notifications right now. */
async function detect(): Promise<{ status: PushStatus; publicKey: string | null }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { status: "unsupported", publicKey: null };
  }
  const { publicKey } = unwrap(await api.GET("/api/v1/push/public-key"));
  if (!publicKey) return { status: "off", publicKey };
  if (Notification.permission === "denied") return { status: "denied", publicKey };
  const worker = await registration();
  if (!worker) return { status: "no-worker", publicKey };
  const current = await worker.pushManager.getSubscription();
  return { status: current ? "subscribed" : "ready", publicKey };
}

/** Price-drop notifications on this device. */
export function usePush() {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    detect()
      .then((result) => {
        if (cancelled) return;
        setPublicKey(result.publicKey);
        setStatus(result.status);
      })
      .catch(() => !cancelled && setStatus("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    const worker = await registration();
    if (!worker || !publicKey) return;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus(permission === "denied" ? "denied" : "ready");
      return;
    }
    const subscription =
      (await worker.pushManager.getSubscription()) ??
      (await worker.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(publicKey),
      }));
    const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    unwrap(await api.POST("/api/v1/push/subscriptions", { body: { endpoint: json.endpoint, keys: json.keys } }));
    setStatus("subscribed");
  }, [publicKey]);

  const disable = useCallback(async () => {
    const subscription = await (await registration())?.pushManager.getSubscription();
    if (subscription) {
      await api.POST("/api/v1/push/subscriptions/remove", { body: { endpoint: subscription.endpoint } });
      await subscription.unsubscribe();
    }
    setStatus("ready");
  }, []);

  const test = useCallback(async () => unwrap(await api.POST("/api/v1/push/test")).sent, []);

  return { status, enable, disable, test };
}

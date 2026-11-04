"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js in production builds only: in development a cached
 * shell would hide hot-reload changes. Set NEXT_PUBLIC_ENABLE_SW_IN_DEV=true to test it locally.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW_IN_DEV === "true";
    if (!enabled || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // The app works without the worker; offline support is a bonus.
    });
  }, []);
  return null;
}

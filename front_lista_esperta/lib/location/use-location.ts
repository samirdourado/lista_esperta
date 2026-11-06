"use client";

import { useCallback, useEffect, useState } from "react";
import { readPreferences, writePreferences } from "@/lib/device/device-store";

export interface Point {
  lat: number;
  lng: number;
}

export type LocationStatus = "idle" | "locating" | "ready" | "denied" | "unavailable";

export interface LocationState {
  status: LocationStatus;
  point?: Point;
  /** gps = this visit; saved = last known on this device; address = typed by the person. */
  source?: "gps" | "saved" | "address";
  label?: string;
  /** Radius of uncertainty of the GPS reading, in metres. */
  accuracyM?: number;
}

/** Above this, the browser is guessing (Wi-Fi or IP): ask the person to confirm the address. */
export const IMPRECISE_M = 500;

/**
 * A fresh, precise reading: the person just tapped "Usar minha localização",
 * so no cached position (desktop browsers often cache an IP-based guess).
 */
function currentPosition(): Promise<{ point: Point; accuracyM: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          point: { lat: position.coords.latitude, lng: position.coords.longitude },
          accuracyM: Math.round(position.coords.accuracy),
        }),
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable")),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

/**
 * Where the person is. Starts from the last point saved on the device (works
 * offline), asks the browser only when the person taps "Usar minha
 * localização", and accepts a typed address when permission is denied.
 */
export function useLocation() {
  const [state, setState] = useState<LocationState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    readPreferences()
      .then((prefs) => {
        if (cancelled || !prefs.lastLocation) return;
        const { lat, lng } = prefs.lastLocation;
        setState((current) =>
          current.status === "idle" ? { status: "ready", point: { lat, lng }, source: "saved" } : current,
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const remember = useCallback((point: Point) => {
    void writePreferences({ lastLocation: { ...point, at: new Date().toISOString() } }).catch(() => undefined);
  }, []);

  const locate = useCallback(async () => {
    setState((current) => ({ ...current, status: "locating" }));
    try {
      const { point, accuracyM } = await currentPosition();
      remember(point);
      setState({ status: "ready", point, source: "gps", accuracyM });
    } catch (error) {
      const reason = error instanceof Error && error.message === "denied" ? "denied" : "unavailable";
      setState((current) => ({ ...current, status: current.point ? "ready" : reason }));
      return reason;
    }
    return "ready";
  }, [remember]);

  const setManual = useCallback(
    (point: Point, label: string) => {
      remember(point);
      setState({ status: "ready", point, source: "address", label });
    },
    [remember],
  );

  return { ...state, locate, setManual };
}

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
}

function currentPosition(): Promise<Point> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable")),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
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
      const point = await currentPosition();
      remember(point);
      setState({ status: "ready", point, source: "gps" });
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

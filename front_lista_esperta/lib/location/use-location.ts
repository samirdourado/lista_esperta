"use client";

import { useCallback, useEffect, useState } from "react";
import { readPreferences, writePreferences } from "@/lib/device/device-store";

export interface Point {
  lat: number;
  lng: number;
}

/**
 * checking: reading the saved place; imprecise: the browser answered, but only
 * with a guess too wide to compare stores (D-075).
 */
export type LocationStatus = "checking" | "idle" | "locating" | "ready" | "imprecise" | "denied" | "unavailable";

export interface LocationState {
  status: LocationStatus;
  point?: Point;
  /** gps = this visit; saved = last known on this device; address = typed by the person. */
  source?: "gps" | "saved" | "address";
  label?: string;
  /** Radius of uncertainty of the GPS reading, in metres. */
  accuracyM?: number;
  /** The wide guess, kept so the person can still choose to use it. */
  approximate?: { point: Point; accuracyM: number };
}

/** Above this the reading is a guess (Wi-Fi or IP), not where the person is. */
export const IMPRECISE_M = 1000;
/** Good enough to stop listening early (a phone GPS gets here in seconds). */
const PRECISE_M = 100;
const WATCH_MS = 15_000;

/**
 * The best reading in a few seconds. Phones answer first from the network and
 * then refine with the GPS, so we keep listening and keep the most accurate
 * fix instead of taking the first one. No cached positions.
 */
function bestPosition(): Promise<{ point: Point; accuracyM: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("unavailable"));
      return;
    }
    let best: { point: Point; accuracyM: number } | null = null;
    let watchId = 0;
    const finish = () => {
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (best) resolve(best);
      else reject(new Error("unavailable"));
    };
    const timer = setTimeout(finish, WATCH_MS);
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const reading = {
          point: { lat: position.coords.latitude, lng: position.coords.longitude },
          accuracyM: Math.round(position.coords.accuracy),
        };
        if (!best || reading.accuracyM < best.accuracyM) best = reading;
        if (best.accuracyM <= PRECISE_M) finish();
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          navigator.geolocation.clearWatch(watchId);
          clearTimeout(timer);
          reject(new Error("denied"));
        }
        // Timeouts and "position unavailable" may still be followed by a fix: keep waiting.
      },
      { enableHighAccuracy: true, timeout: WATCH_MS, maximumAge: 0 },
    );
  });
}

/**
 * Where the person is. Reuses the place saved on this device when it is
 * trustworthy (a typed address or a precise GPS fix), otherwise asks the
 * browser for a precise reading. A wide guess is never used on its own: the
 * screen asks for the CEP instead (D-075).
 */
export function useLocation() {
  const [state, setState] = useState<LocationState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    readPreferences()
      .then((prefs) => {
        if (cancelled) return;
        const saved = prefs.lastLocation;
        const trusted = saved && (saved.source === "address" || (saved.accuracyM ?? Infinity) <= IMPRECISE_M);
        setState((current) => {
          if (current.status !== "checking") return current;
          if (!saved || !trusted) return { status: "idle" };
          return {
            status: "ready",
            point: { lat: saved.lat, lng: saved.lng },
            source: saved.source === "address" ? "address" : "saved",
            label: saved.label,
          };
        });
      })
      .catch(() => !cancelled && setState((current) => (current.status === "checking" ? { status: "idle" } : current)));
    return () => {
      cancelled = true;
    };
  }, []);

  const remember = useCallback(
    (lastLocation: NonNullable<Awaited<ReturnType<typeof readPreferences>>["lastLocation"]>) => {
      void writePreferences({ lastLocation }).catch(() => undefined);
    },
    [],
  );

  const locate = useCallback(async (): Promise<LocationStatus> => {
    setState((current) => ({ ...current, status: "locating" }));
    try {
      const { point, accuracyM } = await bestPosition();
      if (accuracyM > IMPRECISE_M) {
        setState((current) => ({ ...current, status: "imprecise", approximate: { point, accuracyM } }));
        return "imprecise";
      }
      remember({ ...point, at: new Date().toISOString(), source: "gps", accuracyM });
      setState({ status: "ready", point, source: "gps", accuracyM });
      return "ready";
    } catch (error) {
      const reason = error instanceof Error && error.message === "denied" ? "denied" : "unavailable";
      setState((current) => ({ ...current, status: current.point ? "ready" : reason }));
      return reason;
    }
  }, [remember]);

  /** The person chose to go on with the wide guess (not saved for next time). */
  const acceptApproximate = useCallback(() => {
    setState((current) =>
      current.approximate
        ? {
            status: "ready",
            point: current.approximate.point,
            source: "gps",
            accuracyM: current.approximate.accuracyM,
          }
        : current,
    );
  }, []);

  const setManual = useCallback(
    (point: Point, label: string) => {
      remember({ ...point, at: new Date().toISOString(), source: "address", label });
      setState({ status: "ready", point, source: "address", label });
    },
    [remember],
  );

  return { ...state, locate, setManual, acceptApproximate };
}

// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readPreferences, writePreferences } from "@/lib/device/device-store";
import { useLocation } from "./use-location";

type Reading = { lat: number; lng: number; accuracy: number };

/** A browser that answers with these readings, one after the other. */
function fakeGeolocation(readings: Reading[]) {
  const clearWatch = vi.fn();
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      clearWatch,
      watchPosition: (onFix: (position: GeolocationPosition) => void) => {
        readings.forEach((reading, index) =>
          setTimeout(
            () =>
              onFix({
                coords: { latitude: reading.lat, longitude: reading.lng, accuracy: reading.accuracy },
              } as GeolocationPosition),
            index * 10,
          ),
        );
        return 1;
      },
    },
  });
  return { clearWatch };
}

afterEach(async () => {
  await writePreferences({ lastLocation: undefined });
});

describe("useLocation", () => {
  it("keeps listening until the GPS is precise and uses the best reading", async () => {
    fakeGeolocation([
      { lat: -23.6, lng: -46.7, accuracy: 2500 }, // network guess first
      { lat: -23.6627, lng: -46.7046, accuracy: 25 }, // then the GPS
    ]);
    const { result } = renderHook(() => useLocation());
    await waitFor(() => expect(result.current.status).toBe("idle"));
    await act(async () => {
      expect(await result.current.locate()).toBe("ready");
    });
    expect(result.current).toMatchObject({ point: { lat: -23.6627, lng: -46.7046 }, accuracyM: 25, source: "gps" });
    expect((await readPreferences()).lastLocation).toMatchObject({ source: "gps", accuracyM: 25 });
  });

  it("never uses a wide guess on its own: asks for the CEP and saves nothing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fakeGeolocation([{ lat: -23.6, lng: -46.7, accuracy: 2500 }]);
    const { result } = renderHook(() => useLocation());
    await waitFor(() => expect(result.current.status).toBe("idle"));
    let status: Promise<string> | undefined;
    act(() => {
      status = result.current.locate();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(await status).toBe("imprecise");
    expect(result.current.status).toBe("imprecise");
    expect(result.current.point).toBeUndefined();
    expect(result.current.approximate?.accuracyM).toBe(2500);
    expect((await readPreferences()).lastLocation).toBeUndefined();

    act(() => result.current.acceptApproximate());
    expect(result.current).toMatchObject({ status: "ready", accuracyM: 2500 });
    vi.useRealTimers();
  });

  it("reuses a typed address next time, but not an old unchecked guess", async () => {
    await writePreferences({ lastLocation: { lat: -23.6, lng: -46.7, at: "2026-11-01T00:00:00Z" } });
    const first = renderHook(() => useLocation());
    await waitFor(() => expect(first.result.current.status).toBe("idle"));

    await writePreferences({
      lastLocation: { lat: -23.66, lng: -46.71, at: "", source: "address", label: "Rua A, Socorro" },
    });
    const second = renderHook(() => useLocation());
    await waitFor(() => expect(second.result.current.status).toBe("ready"));
    expect(second.result.current).toMatchObject({ source: "address", label: "Rua A, Socorro" });
  });
});

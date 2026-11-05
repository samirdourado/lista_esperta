"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { cx } from "@/lib/cx";
import { loadMapLibre } from "./load-maplibre";
import type { Point } from "@/lib/location/use-location";
import { MAP_COLORS, mapStyleUrl } from "./map-style";

/**
 * Exact position of the store door: drag the pin or tap the map.
 * The address fields stay the accessible source; the pin only refines it.
 */
export function PinPicker({
  value,
  onChange,
  className,
}: {
  value: Point;
  onChange: (point: Point) => void;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const pin = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    void loadMapLibre().then(({ Map, Marker: MarkerClass, NavigationControl }) => {
      if (cancelled || !container.current) return;
      instance = new Map({
        container: container.current,
        style: mapStyleUrl(),
        center: [value.lng, value.lat],
        zoom: 17,
        attributionControl: { compact: true },
      });
      map.current = instance;
      // The container can still be sizing when the map starts (grid, fonts): keep the canvas in sync.
      const resize = new ResizeObserver(() => instance?.resize());
      resize.observe(container.current);
      instance.once("remove", () => resize.disconnect());
      instance.addControl(new NavigationControl({ showCompass: false }), "top-right");
      const marker = new MarkerClass({ draggable: true, color: MAP_COLORS.store })
        .setLngLat([value.lng, value.lat])
        .addTo(instance);
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLngLat();
        onChangeRef.current({ lat, lng });
      });
      instance.on("click", (event) => {
        marker.setLngLat(event.lngLat);
        onChangeRef.current({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      });
      pin.current = marker;
    });
    return () => {
      cancelled = true;
      instance?.remove();
      map.current = null;
    };
    // Created once; value changes from outside are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const current = pin.current?.getLngLat();
    if (!current || (Math.abs(current.lat - value.lat) < 1e-7 && Math.abs(current.lng - value.lng) < 1e-7)) return;
    pin.current?.setLngLat([value.lng, value.lat]);
    map.current?.easeTo({ center: [value.lng, value.lat], duration: 400 });
  }, [value.lat, value.lng]);

  return (
    <div
      ref={container}
      role="img"
      aria-label="Mapa para ajustar a posição da loja"
      className={cx("overflow-hidden rounded-md border border-line bg-surface-sunken", className)}
    />
  );
}

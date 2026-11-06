"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { loadMapLibre } from "./load-maplibre";
import type { Point } from "@/lib/location/use-location";
import { isDarkTheme, MAP_COLORS, mapStyleUrl, youAreHereElement } from "./map-style";

export interface MapStore {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Shown above the dot, e.g. the price of the list there. */
  label?: string;
  /** Grey dot: a shop with nothing to show yet (no prices). */
  muted?: boolean;
}

interface StoreMapProps {
  center: Point;
  stores: MapStore[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Draws the search radius and zooms to fit it. */
  radiusKm?: number;
  className?: string;
}

const SOURCE = "stores";
const RADIUS = "radius";
const KM_PER_DEGREE = 111.32;

/** A circle of `km` around a point, as a polygon (good enough at city scale). */
function circle(center: Point, km: number) {
  const ring: [number, number][] = [];
  const dLat = km / KM_PER_DEGREE;
  const dLng = km / (KM_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i += 1) {
    const angle = (i / 64) * 2 * Math.PI;
    ring.push([center.lng + dLng * Math.cos(angle), center.lat + dLat * Math.sin(angle)]);
  }
  return {
    type: "Feature" as const,
    geometry: { type: "Polygon" as const, coordinates: [ring] },
    properties: {},
    bounds: [
      [center.lng - dLng, center.lat - dLat],
      [center.lng + dLng, center.lat + dLat],
    ] as [[number, number], [number, number]],
  };
}

/**
 * Stores as dots around the person. The list next to it is the accessible way
 * to browse; the map is a visual aid, so it stays out of the tab order.
 */
export function StoreMap({ center, stores, selectedId, onSelect, radiusKm, className }: StoreMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const you = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once; MapLibre needs window and WebGL, so it loads on the client only.
  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    void loadMapLibre()
      .then(({ Map, Marker: MarkerClass, NavigationControl }) => {
        if (cancelled || !container.current) return;
        const dark = isDarkTheme();
        instance = new Map({
          container: container.current,
          style: mapStyleUrl(),
          center: [center.lng, center.lat],
          zoom: 14,
          attributionControl: { compact: true },
          cooperativeGestures: false,
        });
        map.current = instance;
        // The container can still be sizing when the map starts (grid, fonts): keep the canvas in sync.
        const resize = new ResizeObserver(() => instance?.resize());
        resize.observe(container.current);
        instance.once("remove", () => resize.disconnect());
        instance.addControl(new NavigationControl({ showCompass: false }), "top-right");
        you.current = new MarkerClass({ element: youAreHereElement() })
          .setLngLat([center.lng, center.lat])
          .addTo(instance);

        instance.on("load", () => {
          if (!instance) return;
          instance.addSource(RADIUS, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          instance.addLayer({
            id: `${RADIUS}-fill`,
            type: "fill",
            source: RADIUS,
            paint: { "fill-color": MAP_COLORS.store, "fill-opacity": 0.06 },
          });
          instance.addLayer({
            id: `${RADIUS}-line`,
            type: "line",
            source: RADIUS,
            paint: { "line-color": MAP_COLORS.store, "line-width": 1.5, "line-dasharray": [2, 2] },
          });
          instance.addSource(SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          instance.addLayer({
            id: SOURCE,
            type: "circle",
            source: SOURCE,
            paint: {
              "circle-radius": ["case", ["get", "selected"], 10, ["get", "muted"], 5, 7],
              "circle-color": [
                "case",
                ["get", "selected"],
                dark ? MAP_COLORS.selectedDark : MAP_COLORS.selected,
                ["get", "muted"],
                MAP_COLORS.muted,
                dark ? MAP_COLORS.storeDark : MAP_COLORS.store,
              ],
              "circle-stroke-width": 2,
              "circle-stroke-color": MAP_COLORS.outline,
            },
          });
          instance.addLayer({
            id: `${SOURCE}-labels`,
            type: "symbol",
            source: SOURCE,
            filter: ["has", "label"],
            layout: {
              "text-field": ["get", "label"],
              "text-font": ["Noto Sans Bold"],
              "text-size": ["case", ["get", "selected"], 15, 13],
              "text-offset": [0, -1.5],
              "text-anchor": "bottom",
              "text-allow-overlap": true,
            },
            paint: {
              "text-color": dark ? MAP_COLORS.selectedDark : MAP_COLORS.selected,
              "text-halo-color": dark ? "#0a1430" : "#ffffff",
              "text-halo-width": 2,
            },
          });
          instance.on("click", SOURCE, (event) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === "string") onSelectRef.current?.(id);
          });
          instance.on("mouseenter", SOURCE, () => (instance!.getCanvas().style.cursor = "pointer"));
          instance.on("mouseleave", SOURCE, () => (instance!.getCanvas().style.cursor = ""));
          setReady(true);
        });
        instance.on("error", (event) => {
          // A missing tile is fine; a style that cannot load means no map at all.
          if (!instance?.isStyleLoaded() && String(event.error?.message ?? "").includes("style")) setFailed(true);
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      instance?.remove();
      map.current = null;
    };
    // The map is created once; later center changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    you.current?.setLngLat([center.lng, center.lat]);
    map.current?.easeTo({ center: [center.lng, center.lat], duration: 600 });
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const source = map.current.getSource<GeoJSONSource>(SOURCE);
    source?.setData({
      type: "FeatureCollection",
      features: stores.map((store) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [store.lng, store.lat] },
        properties: {
          id: store.id,
          name: store.name,
          selected: store.id === selectedId,
          muted: Boolean(store.muted),
          ...(store.label ? { label: store.label } : {}),
        },
      })),
    });
  }, [ready, stores, selectedId]);

  useEffect(() => {
    if (!ready || !map.current || !radiusKm) return;
    const area = circle(center, radiusKm);
    map.current.getSource<GeoJSONSource>(RADIUS)?.setData({ type: "FeatureCollection", features: [area] });
    map.current.fitBounds(area.bounds, { padding: 24, duration: 500 });
  }, [ready, radiusKm, center]);

  useEffect(() => {
    const selected = stores.find((store) => store.id === selectedId);
    if (selected && map.current) {
      map.current.easeTo({ center: [selected.lng, selected.lat], duration: 500 });
    }
  }, [selectedId, stores]);

  if (failed) {
    return (
      <div
        className={cx(
          "flex items-center justify-center rounded-md bg-surface-sunken p-4 text-center text-ink-soft",
          className,
        )}
      >
        O mapa não carregou agora. A lista abaixo continua completa.
      </div>
    );
  }

  return (
    <div
      ref={container}
      role="img"
      aria-label={`Mapa com ${stores.length} lojas perto de você`}
      className={cx("overflow-hidden rounded-md border border-line bg-surface-sunken", className)}
    />
  );
}

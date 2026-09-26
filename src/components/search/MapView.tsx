"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MlMap, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { brand } from "@/config/brand";
import { formatPrice } from "@/lib/format";
import type { SearchCluster, SearchPin } from "@/types/search";

export type Bounds = [number, number, number, number];


// Worker files are copied into public/ by scripts/copy_maplibre_worker.ts (bundlers break the default path).
maplibregl.setWorkerUrl(`/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);
const PRICE_LABEL_LIMIT = 60;

function styleFor(): StyleSpecification | string {
  const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (key && !key.includes("replace")) return `https://api.maptiler.com/maps/dataviz-light/style.json?key=${key}`;
  // Without a MapTiler key: OpenFreeMap (free, no key, OpenStreetMap data, attribution shown on the
  // map), unless NEXT_PUBLIC_MAP_STYLE is "outline" for fully offline runs.
  if (process.env.NEXT_PUBLIC_MAP_STYLE !== "outline") return process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";
  // Offline fallback: a calm neutral base drawn from our own region outlines.
  return {
    version: 8,
    sources: { regions: { type: "geojson", data: "/api/regions/geo" } },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#e9ebee" } },
      { id: "city-fill", type: "fill", source: "regions", filter: ["==", ["get", "type"], "city"], paint: { "fill-color": "#fafafa" } },
      { id: "hood-line", type: "line", source: "regions", filter: ["==", ["get", "type"], "neighborhood"], paint: { "line-color": "#d4d4d8", "line-width": 1 } },
      { id: "city-line", type: "line", source: "regions", filter: ["==", ["get", "type"], "city"], paint: { "line-color": "#a1a1aa", "line-width": 1.5 } },
    ],
  };
}

function toBounds(map: MlMap): Bounds {
  const b = map.getBounds();
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => Number(n.toFixed(5))) as Bounds;
}

export default function MapView({
  pins,
  clusters,
  initialBounds,
  hoveredId,
  onHover,
  onSelect,
  onBoundsChange,
  searchAsMove,
  onSearchAsMoveChange,
}: {
  pins: SearchPin[];
  clusters: SearchCluster[];
  initialBounds: Bounds | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onBoundsChange: (b: Bounds) => void;
  searchAsMove: boolean;
  onSearchAsMoveChange: (v: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const lastHover = useRef<string | null>(null);
  const handlers = useRef({ onHover, onSelect, onBoundsChange, searchAsMove });
  handlers.current = { onHover, onSelect, onBoundsChange, searchAsMove };
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Create the map once (and again after a retry).
  useEffect(() => {
    if (!container.current) return;
    let map: MlMap;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: styleFor(),
        // The search page always passes a view: the place searched, or every city in the market.
        bounds: initialBounds ?? [-180, -60, 180, 75],
        fitBoundsOptions: { padding: { top: 72, bottom: 40, left: 40, right: 56 } },
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        maxZoom: 18,
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("error", (e) => {
      if (String(e.error?.message ?? "").includes("WebGL")) setFailed(true);
    });

    map.on("load", () => {
      map.addSource("pins", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" });
      map.addLayer({
        id: "pins",
        type: "circle",
        source: "pins",
        paint: {
          "circle-color": ["case", ["boolean", ["feature-state", "hover"], false], "#18181b", brand.color],
          "circle-radius": ["case", ["boolean", ["feature-state", "hover"], false], 9, 6],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.on("mousemove", "pins", (e) => {
        map.getCanvas().style.cursor = "pointer";
        handlers.current.onHover(String(e.features?.[0]?.id ?? "") || null);
      });
      map.on("mouseleave", "pins", () => {
        map.getCanvas().style.cursor = "";
        handlers.current.onHover(null);
      });
      map.on("click", "pins", (e) => handlers.current.onSelect(String(e.features?.[0]?.id ?? "") || null));
      setReady(true);
    });

    // Only user gestures move the search; programmatic fits must not rewrite the URL.
    map.on("moveend", (e) => {
      if (!("originalEvent" in e) || !e.originalEvent) return;
      if (handlers.current.searchAsMove) handlers.current.onBoundsChange(toBounds(map));
    });

    return () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // initialBounds is only the starting view; later changes come from the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Results: circle pins, price labels under 60 results, or cluster markers above 200.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    const usePriceLabels = pins.length > 0 && pins.length < PRICE_LABEL_LIMIT;

    (map.getSource("pins") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: usePriceLabels
        ? []
        : pins.map((p) => ({ type: "Feature", id: p.id, properties: { id: p.id }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })),
    });

    if (usePriceLabels) {
      for (const p of pins) {
        const el = document.createElement("button");
        el.type = "button";
        el.dataset.testid = "price-pin";
        el.dataset.id = p.id;
        el.className = "map-price-pin";
        el.textContent = formatPrice(p.price, { compact: true });
        el.setAttribute("aria-label", `Listing for ${formatPrice(p.price)}`);
        el.addEventListener("mouseenter", () => handlers.current.onHover(p.id));
        el.addEventListener("mouseleave", () => handlers.current.onHover(null));
        el.addEventListener("click", () => handlers.current.onSelect(p.id));
        markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map));
      }
    }

    for (const c of clusters) {
      const el = document.createElement("button");
      el.type = "button";
      el.dataset.testid = "cluster";
      el.className = "map-cluster";
      const size = Math.min(56, 28 + Math.log10(c.count) * 10);
      el.style.width = el.style.height = `${size}px`;
      el.textContent = c.count >= 1000 ? `${(c.count / 1000).toFixed(1)}k` : String(c.count);
      el.setAttribute("aria-label", `${c.count} homes here. Zoom in`);
      el.addEventListener("click", () => {
        const [w, s, e, n] = c.bounds;
        map.fitBounds([[w, s], [e, n]], { padding: 48, maxZoom: 16, duration: 300 });
        // A programmatic zoom still counts as the user moving the map.
        map.once("moveend", () => handlers.current.searchAsMove && handlers.current.onBoundsChange(toBounds(map)));
      });
      markers.current.push(new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(map));
    }
  }, [pins, clusters, ready]);

  // List hover highlights the pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (lastHover.current && map.getSource("pins")) map.setFeatureState({ source: "pins", id: lastHover.current }, { hover: false });
    if (hoveredId && map.getSource("pins")) map.setFeatureState({ source: "pins", id: hoveredId }, { hover: true });
    lastHover.current = hoveredId;
    for (const m of markers.current) {
      const el = m.getElement();
      el.classList.toggle("is-hovered", !!hoveredId && el.dataset.id === hoveredId);
    }
  }, [hoveredId, ready]);

  if (failed) {
    return (
      <div className="grid h-full place-items-center bg-neutral-100 p-6 text-center">
        <div>
          <p className="text-body text-neutral-700">The map could not load. The list shows every result.</p>
          <button type="button" className="mt-2 min-h-11 text-accent hover:underline" onClick={() => { setFailed(false); setAttempt((a) => a + 1); }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={container} data-testid="map" data-ready={ready} className="h-full w-full" role="region" aria-label="Map of results" />
      <label className="absolute left-3 top-3 z-10 flex min-h-11 cursor-pointer items-center gap-2 rounded-md bg-white px-3 text-small font-medium text-neutral-800 shadow-card">
        <input
          type="checkbox"
          checked={searchAsMove}
          onChange={(e) => onSearchAsMoveChange(e.target.checked)}
          className="size-4 accent-[var(--color-accent)]"
        />
        Search as I move the map
      </label>
    </div>
  );
}

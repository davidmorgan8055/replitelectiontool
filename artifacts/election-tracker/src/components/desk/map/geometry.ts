// US state geometry from us-atlas (states-albers-10m.json, pre-projected Albers USA with AK/HI insets).
// Data: U.S. Census Bureau cartographic boundary files (public domain), packaged by us-atlas (ISC license, Mike Bostock).
// Bundled locally at build time; no remote requests at runtime.
import { feature, mesh } from "topojson-client";
import { geoPath } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import atlas from "us-atlas/states-albers-10m.json";
import { FIPS_TO_ABBR } from "@/lib/map-logic";

export const VIEWBOX = "0 0 975 610";
export interface StateShape { abbr: string; d: string; cx: number; cy: number; area: number }

const topo = atlas as unknown as Topology<{ states: GeometryCollection<{ name: string }> }>;
const path = geoPath(null);

export const STATE_SHAPES: StateShape[] = feature(topo, topo.objects.states).features
  .map((f) => {
    const abbr = FIPS_TO_ABBR[String(f.id).padStart(2, "0")];
    if (!abbr) return null;
    const [cx, cy] = path.centroid(f);
    return { abbr, d: path(f) ?? "", cx, cy, area: path.area(f) };
  })
  .filter((s): s is StateShape => s !== null)
  .sort((a, b) => a.abbr.localeCompare(b.abbr));

export const BORDERS = path(mesh(topo, topo.objects.states, (a, b) => a !== b)) ?? "";

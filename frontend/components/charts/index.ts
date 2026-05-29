"use client";
/**
 * Lazy Recharts re-exports.
 *
 * Recharts pulls in ~140KB gzipped, dominated by D3 sub-bundles. By loading
 * the whole library via next/dynamic and bouncing the imports through a
 * single dynamic boundary, we keep it out of the initial chunk and only
 * fetch it on the first page that renders a chart.
 *
 * Usage (drop-in replacement for `from "recharts"`):
 *   import { LineChart, Line, ResponsiveContainer } from "@/components/charts";
 *
 * Limitations: components are loaded together (one network round-trip after
 * the first lazy import); subsequent charts re-use the cached module.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

function dyn<T>(loader: () => Promise<{ default: ComponentType<T> } | ComponentType<T>>) {
  return dynamic(
    async () => {
      const mod = await loader() as any;
      return mod;
    },
    { ssr: false },
  ) as unknown as ComponentType<T>;
}

// We import the full library once and tree-shake within the lazy chunk.
const rechartsImport = () => import("recharts");

export const LineChart            = dyn<any>(async () => ({ default: (await rechartsImport()).LineChart as any }));
export const Line                 = dyn<any>(async () => ({ default: (await rechartsImport()).Line as any }));
export const BarChart             = dyn<any>(async () => ({ default: (await rechartsImport()).BarChart as any }));
export const Bar                  = dyn<any>(async () => ({ default: (await rechartsImport()).Bar as any }));
export const AreaChart            = dyn<any>(async () => ({ default: (await rechartsImport()).AreaChart as any }));
export const Area                 = dyn<any>(async () => ({ default: (await rechartsImport()).Area as any }));
export const PieChart             = dyn<any>(async () => ({ default: (await rechartsImport()).PieChart as any }));
export const Pie                  = dyn<any>(async () => ({ default: (await rechartsImport()).Pie as any }));
export const Cell                 = dyn<any>(async () => ({ default: (await rechartsImport()).Cell as any }));
export const RadarChart           = dyn<any>(async () => ({ default: (await rechartsImport()).RadarChart as any }));
export const Radar                = dyn<any>(async () => ({ default: (await rechartsImport()).Radar as any }));
export const PolarGrid            = dyn<any>(async () => ({ default: (await rechartsImport()).PolarGrid as any }));
export const PolarAngleAxis       = dyn<any>(async () => ({ default: (await rechartsImport()).PolarAngleAxis as any }));
export const ResponsiveContainer  = dyn<any>(async () => ({ default: (await rechartsImport()).ResponsiveContainer as any }));
export const XAxis                = dyn<any>(async () => ({ default: (await rechartsImport()).XAxis as any }));
export const YAxis                = dyn<any>(async () => ({ default: (await rechartsImport()).YAxis as any }));
export const Tooltip              = dyn<any>(async () => ({ default: (await rechartsImport()).Tooltip as any }));
export const CartesianGrid        = dyn<any>(async () => ({ default: (await rechartsImport()).CartesianGrid as any }));
export const Legend               = dyn<any>(async () => ({ default: (await rechartsImport()).Legend as any }));

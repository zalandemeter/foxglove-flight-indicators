import { SettingsTreeChildren } from "@foxglove/extension";
import { Parser } from "expr-eval";

const exprParser = new Parser();

// ── Types ─────────────────────────────────────────────────────────────────────

export type ColorZone = { color: string; start: number; end: number };

/**
 * A loose config bag for zone key lookup.
 * Keys follow the pattern: `${prefix}${i}Start`, `${prefix}${i}End`, `${prefix}${i}Color`
 */
export type ZoneConfig = Record<string, unknown>;

export const MAX_ZONES = 7;

// ── Drawing helpers ───────────────────────────────────────────────────────────

const ARC_R = 145;

/**
 * Draw major + optional minor tick lines into a <g> element.
 * majorAngles: one angle (degrees, screen-frame) per major tick.
 * Minor ticks are drawn at the midpoint angle between adjacent major ticks.
 */
export type SubTickMode = "none" | "simple" | "detailed";

export function drawTickLines(
  g: SVGGElement,
  majorAngles: number[],
  pivotX: number,
  pivotY: number,
  subTickMode: SubTickMode,
): void {
  while (g.firstChild) g.removeChild(g.firstChild);
  if (majorAngles.length < 2) return;

  function addLine(x1: number, y1: number, x2: number, y2: number, sw: number): void {
    const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
    ln.setAttribute("x1", x1.toFixed(2)); ln.setAttribute("y1", y1.toFixed(2));
    ln.setAttribute("x2", x2.toFixed(2)); ln.setAttribute("y2", y2.toFixed(2));
    ln.setAttribute("stroke", "white");
    ln.setAttribute("stroke-width", String(sw));
    ln.setAttribute("stroke-linecap", "butt");
    g.appendChild(ln);
  }

  for (const deg of majorAngles) {
    const rad = (deg * Math.PI) / 180;
    addLine(pivotX + 129 * Math.cos(rad), pivotY + 129 * Math.sin(rad),
            pivotX + 150 * Math.cos(rad), pivotY + 150 * Math.sin(rad), 4);
  }
  if (subTickMode === "simple") {
    for (let i = 0; i < majorAngles.length - 1; i++) {
      const mid = (majorAngles[i]! + majorAngles[i + 1]!) / 2;
      const rad = (mid * Math.PI) / 180;
      addLine(pivotX + 135 * Math.cos(rad), pivotY + 135 * Math.sin(rad),
              pivotX + 150 * Math.cos(rad), pivotY + 150 * Math.sin(rad), 2);
    }
  } else if (subTickMode === "detailed") {
    for (let i = 0; i < majorAngles.length - 1; i++) {
      const a = majorAngles[i]!;
      const b = majorAngles[i + 1]!;
      const q1 = a + (b - a) * 0.25;
      const q2 = a + (b - a) * 0.5;
      const q3 = a + (b - a) * 0.75;
      // Short ticks at 1/4 and 3/4
      for (const deg of [q1, q3]) {
        const rad = (deg * Math.PI) / 180;
        addLine(pivotX + 140 * Math.cos(rad), pivotY + 140 * Math.sin(rad),
                pivotX + 150 * Math.cos(rad), pivotY + 150 * Math.sin(rad), 2);
      }
      // Medium tick at 1/2
      const rad = (q2 * Math.PI) / 180;
      addLine(pivotX + 135 * Math.cos(rad), pivotY + 135 * Math.sin(rad),
              pivotX + 150 * Math.cos(rad), pivotY + 150 * Math.sin(rad), 2);
    }
  }
}

/**
 * Draw color arc zones into a <g> element. Zones rendered in order (last = topmost).
 * Arcs are clamped to [displayMin, displayMax]; zero-length zones are skipped.
 *
 * @param angleFn  Maps a value in [displayMin, displayMax] to a screen angle in degrees.
 *                 For DualGauge left:  leftAngleDeg   (sweepDir = 0, CCW in SVG)
 *                 For DualGauge right: rightAngleDeg  (sweepDir = 1, CW  in SVG)
 *                 For single Gauge:    gaugeAngleDeg  (sweepDir = 1, CW  in SVG)
 * @param sweepDir SVG arc sweep-flag: 0 = CCW, 1 = CW
 */
export function drawColorArcs(
  g: SVGGElement,
  displayMin: number,
  displayMax: number,
  pivotX: number,
  pivotY: number,
  angleFn: (v: number, min: number, max: number) => number,
  sweepDir: 0 | 1,
  zones: ColorZone[],
): void {
  while (g.firstChild) g.removeChild(g.firstChild);
  if (displayMax - displayMin <= 0) return;

  for (const { color, start, end } of zones) {
    const cStart = Math.max(displayMin, Math.min(displayMax, start));
    const cEnd   = Math.max(displayMin, Math.min(displayMax, end));
    if (cEnd <= cStart) continue;

    const a1Deg = angleFn(cStart, displayMin, displayMax);
    const a2Deg = angleFn(cEnd,   displayMin, displayMax);
    const a1 = (a1Deg * Math.PI) / 180;
    const a2 = (a2Deg * Math.PI) / 180;
    const x1 = pivotX + ARC_R * Math.cos(a1);
    const y1 = pivotY + ARC_R * Math.sin(a1);
    const x2 = pivotX + ARC_R * Math.cos(a2);
    const y2 = pivotY + ARC_R * Math.sin(a2);

    // Compute angular span to set large-arc flag correctly for arcs > 180°
    const rawSpan = sweepDir === 1 ? a2Deg - a1Deg : a1Deg - a2Deg;
    const span = (rawSpan % 360 + 360) % 360;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    // Full circle (span ≈ 360°): SVG arc can't draw when start == end, use two semicircles
    if (span < 0.01 && Math.abs(rawSpan) > 1) {
      const aMid = (a1Deg + 180) * Math.PI / 180;
      const mx = pivotX + ARC_R * Math.cos(aMid);
      const my = pivotY + ARC_R * Math.sin(aMid);
      path.setAttribute("d",
        `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${ARC_R} ${ARC_R} 0 1 ${sweepDir} ${mx.toFixed(2)} ${my.toFixed(2)} A ${ARC_R} ${ARC_R} 0 1 ${sweepDir} ${x1.toFixed(2)} ${y1.toFixed(2)}`);
    } else {
      const largeArc = span > 180 ? 1 : 0;
      path.setAttribute("d", `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${ARC_R} ${ARC_R} 0 ${largeArc} ${sweepDir} ${x2.toFixed(2)} ${y2.toFixed(2)}`);
    }
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "10");
    g.appendChild(path);
  }
}

// ── Zone config helpers ───────────────────────────────────────────────────────

/**
 * Build a ColorZone[] from a config object using the key naming pattern
 * `${prefix}${i}Start`, `${prefix}${i}End`, `${prefix}${i}Color` for i in 1..count.
 *
 * Usage:
 *   buildZones(config, "leftZone",  config.leftZoneCount)   // DualGauge
 *   buildZones(config, "rightZone", config.rightZoneCount)  // DualGauge
 *   buildZones(config, "zone",      config.zoneCount)       // single Gauge
 */
export function buildZones(config: ZoneConfig, prefix: string, count: number): ColorZone[] {
  const zones: ColorZone[] = [];
  for (let i = 1; i <= count; i++) {
    zones.push({
      start: config[`${prefix}${i}Start`] as number,
      end:   config[`${prefix}${i}End`]   as number,
      color: config[`${prefix}${i}Color`] as string,
    });
  }
  return zones;
}

/**
 * Build SettingsTreeChildren for zone sub-nodes.
 *
 * Usage:
 *   makeZoneChildren("leftZone",  config.leftZoneCount,  config)  // DualGauge
 *   makeZoneChildren("rightZone", config.rightZoneCount, config)  // DualGauge
 *   makeZoneChildren("zone",      config.zoneCount,      config)  // single Gauge
 */
export function makeZoneChildren(
  prefix: string,
  count: number,
  config: ZoneConfig,
): SettingsTreeChildren {
  const children: SettingsTreeChildren = {};
  for (let i = 1; i <= count; i++) {
    const startKey = `${prefix}${i}Start`;
    const endKey   = `${prefix}${i}End`;
    const colorKey = `${prefix}${i}Color`;
    const zStart = config[startKey] as number;
    const zEnd   = config[endKey]   as number;
    children[`${prefix}${i}`] = {
      label: `Zone ${i}`,
      defaultExpansionState: "collapsed",
      error: zEnd <= zStart ? "Max must be greater than min" : undefined,
      fields: {
        [startKey]: { label: "Min",   input: "number", value: zStart },
        [endKey]:   { label: "Max",   input: "number", value: zEnd   },
        [colorKey]: { label: "Color", input: "rgb",    value: config[colorKey] as string },
      },
    };
  }
  return children;
}

// ── Expression / tick validation helpers ─────────────────────────────────────

export function parseTickLabels(str: string, expectedCount: number): string[] | undefined {
  if (!str.trim()) return undefined;
  const parts = str.split(",").map((s) => s.trim());
  return parts.length === expectedCount ? parts : undefined;
}

export function exprError(str: string): string | undefined {
  if (!str.trim()) return undefined;
  try { exprParser.parse(str); return undefined; }
  catch (e) { return `Invalid expression: ${(e as Error).message}`; }
}

export function applyExpr(raw: number, expr: string): number {
  if (!expr.trim()) return raw;
  try { return exprParser.parse(expr).evaluate({ x: raw }) as number; }
  catch { return raw; }
}

export function bottomLabelError(str: string): string | undefined {
  const count = str.split(",").length;
  return count > 2 ? `Bottom label: max 2 values, got ${count}` : undefined;
}

export function tickLabelsError(str: string, count: number): string | undefined {
  if (!str.trim()) return undefined;
  const got = str.split(",").length;
  return got !== count ? `Tick labels: expected ${count}, got ${got}` : undefined;
}

export function parseTickPositions(str: string, expectedCount: number): number[] | undefined {
  if (!str.trim()) return undefined;
  const parts = str.split(",").map((s) => Number(s.trim()));
  return parts.length === expectedCount && parts.every((n) => !isNaN(n)) ? parts : undefined;
}

export function tickPositionsError(str: string, count: number): string | undefined {
  if (!str.trim()) return undefined;
  const parts = str.split(",");
  if (parts.length !== count) return `Tick positions: expected ${count}, got ${parts.length}`;
  if (parts.some((s) => isNaN(Number(s.trim())))) return "Tick positions: all values must be numbers";
  return undefined;
}

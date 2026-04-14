import { ReactElement, useEffect, useRef } from "react";

import { ensureCss } from "../BundledFlightIndicators";
import fiCircleRaw from "../assets/instruments/fi_circle.svg?raw";
import fiNeedleRaw from "../assets/instruments/fi_needle.svg?raw";
import { ColorZone, SubTickMode, drawColorArcs, drawTickLines } from "../gaugeShared";
import { toDataUrl } from "../utils";

const NEEDLE_URL = toDataUrl(fiNeedleRaw);
const CIRCLE_URL = toDataUrl(fiCircleRaw);

// Single-gauge geometry (center pivot):
//   Canvas: 400×400, pivot at (200, 200), transform-origin: "50% 50%"
//   Rotation formula: rotate(BASE_DEG + (v - displayMin) / (displayMax - displayMin) * SWEEP_DEG)deg
//     v = displayMin → rotate(90deg)   (0 mark)
//     v = displayMax → rotate(410deg)  (full-scale mark)
//
// tickCount = 0 → skip tick drawing entirely (face markings are primary)
const BASE_DEG  = 90;
const SWEEP_OPEN = 320;
const SWEEP_FULL = 360;
const MAX_TICKS = 20;

/** CSS rotation angle for the needle (needle SVG points LEFT, so rotate(90°) = UP = 0-mark). */
function gaugeAngleDeg(v: number, min: number, max: number, sweep: number): number {
  return BASE_DEG + ((v - min) / (max - min)) * sweep;
}

/** Position angle for cos/sin placement (ticks, arcs, labels). +180° because needle points LEFT. */
function gaugePositionDeg(v: number, min: number, max: number, sweep: number): number {
  return gaugeAngleDeg(v, min, max, sweep) + 180;
}

export type Props = {
  value: number | undefined;
  size: string;
  faceUrl: string;
  displayMin: number;
  displayMax: number;
  clamp: boolean;
  clampMin: number;
  clampMax: number;
  tickCount: number;
  tickPrecision: number;
  subTicks: SubTickMode;
  tickLabels?: string[];
  tickPositions?: number[];
  zones: ColorZone[];
  topLabel: string;
  bottomLabel: string;
  fullSweep: boolean;
};

export function Gauge({
  value, size, faceUrl,
  displayMin, displayMax,
  clamp, clampMin, clampMax,
  tickCount, tickPrecision, subTicks,
  tickLabels, tickPositions,
  zones,
  topLabel, bottomLabel,
  fullSweep,
}: Props): ReactElement {
  const sweep = fullSweep ? SWEEP_FULL : SWEEP_OPEN;
  const containerRef = useRef<HTMLDivElement>(null);
  const needleRef    = useRef<HTMLDivElement | null>(null);
  const labelTopRef  = useRef<HTMLDivElement | null>(null);
  const labelBotRef  = useRef<HTMLDivElement | null>(null);
  const tickRefs     = useRef<(HTMLDivElement | null)[]>(Array(MAX_TICKS).fill(null));
  const arcGRef      = useRef<SVGGElement | null>(null);
  const tickGRef     = useRef<SVGGElement | null>(null);

  // ── Build DOM once ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    ensureCss();

    const instrument = document.createElement("div");
    instrument.className = "instrument gauge";

    // Face
    const face = document.createElement("img");
    face.className = "box";
    face.src = faceUrl;
    instrument.appendChild(face);

    // SVG overlay (arcs below ticks, both below needle)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 400 400");
    svg.style.position      = "absolute";
    svg.style.top           = "0";
    svg.style.left          = "0";
    svg.style.width         = "100%";
    svg.style.height        = "100%";
    svg.style.pointerEvents = "none";
    const arcG  = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const tickG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svg.appendChild(arcG);
    svg.appendChild(tickG);
    instrument.appendChild(svg);

    // Label helper
    function makeTextDiv(): HTMLDivElement {
      const d = document.createElement("div");
      d.style.position      = "absolute";
      d.style.transform     = "translate(-50%, -50%)";
      d.style.color         = "white";
      d.style.fontFamily    = "Noto Sans KR, sans-serif";
      d.style.fontWeight    = "bold";
      d.style.pointerEvents = "none";
      d.style.whiteSpace    = "nowrap";
      return d;
    }

    // Top / bottom labels (before needle so needle renders on top)
    const topEl = makeTextDiv(); topEl.style.left = "50%"; topEl.style.top = "38%";
    const botEl = makeTextDiv(); botEl.style.left = "50%"; botEl.style.top = "62%";
    instrument.appendChild(topEl);
    instrument.appendChild(botEl);

    // Needle
    const needleDiv = document.createElement("div");
    needleDiv.className = "box";
    needleDiv.style.transformOrigin = "50% 50%";
    needleDiv.style.transform       = `rotate(${BASE_DEG}deg)`;
    const needleImg = document.createElement("img");
    needleImg.className = "box";
    needleImg.src = NEEDLE_URL;
    needleDiv.appendChild(needleImg);
    instrument.appendChild(needleDiv);

    // Bezel
    const capDiv = document.createElement("div");
    capDiv.className = "mechanics box";
    const capImg = document.createElement("img");
    capImg.className = "box";
    capImg.src = CIRCLE_URL;
    capDiv.appendChild(capImg);
    instrument.appendChild(capDiv);

    // Tick label pool
    const ticks: HTMLDivElement[] = [];
    for (let i = 0; i < MAX_TICKS; i++) {
      const d = makeTextDiv(); d.style.display = "none";
      instrument.appendChild(d); ticks.push(d);
    }

    el.appendChild(instrument);
    needleRef.current   = needleDiv;
    labelTopRef.current = topEl;
    labelBotRef.current = botEl;
    tickRefs.current    = ticks;
    arcGRef.current     = arcG;
    tickGRef.current    = tickG;

    return () => {
      el.innerHTML        = "";
      needleRef.current   = null;
      labelTopRef.current = null;
      labelBotRef.current = null;
      tickRefs.current    = Array(MAX_TICKS).fill(null);
      arcGRef.current     = null;
      tickGRef.current    = null;
    };
  // faceUrl is a module-level constant per panel type — intentionally excluded from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resize ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const n = parseInt(size, 10);
    if (!isNaN(n)) {
      const instrument = containerRef.current?.querySelector<HTMLElement>(".instrument");
      if (instrument) {
        instrument.style.width  = `${n}px`;
        instrument.style.height = `${n}px`;
      }
      const tickFs = `${(n * 18 / 400).toFixed(1)}px`;
      const labelFs = `${(n * 18 / 400).toFixed(1)}px`;
      if (labelTopRef.current) labelTopRef.current.style.fontSize = labelFs;
      if (labelBotRef.current) labelBotRef.current.style.fontSize = labelFs;
      for (const ref of tickRefs.current) {
        if (ref) ref.style.fontSize = tickFs;
      }
    }
  }, [size]);

  // ── Needle ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (value == null || !needleRef.current) return;
    if (displayMax <= displayMin) return;
    const v = clamp ? Math.max(clampMin, Math.min(clampMax, value)) : value;
    needleRef.current.style.transform = `rotate(${gaugeAngleDeg(v, displayMin, displayMax, sweep)}deg)`;
  }, [value, displayMin, displayMax, clamp, clampMin, clampMax, sweep]);

  // ── Labels ─────────────────────────────────────────────────────────────────
  useEffect(() => { if (labelTopRef.current) labelTopRef.current.textContent = topLabel; },    [topLabel]);
  useEffect(() => { if (labelBotRef.current) labelBotRef.current.textContent = bottomLabel; }, [bottomLabel]);

  // ── Color arcs ─────────────────────────────────────────────────────────────
  const zonesKey = JSON.stringify(zones);
  useEffect(() => {
    if (!arcGRef.current) return;
    drawColorArcs(arcGRef.current, displayMin, displayMax, 200, 200, (v, min, max) => gaugePositionDeg(v, min, max, sweep), 1, zones);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMin, displayMax, zonesKey, sweep]);

  // ── Ticks ──────────────────────────────────────────────────────────────────
  const tickLabelsKey    = JSON.stringify(tickLabels);
  const tickPositionsKey = JSON.stringify(tickPositions);
  useEffect(() => {
    const ticks = tickRefs.current;
    if (tickCount === 0 || displayMax <= displayMin) {
      if (tickGRef.current) {
        while (tickGRef.current.firstChild) tickGRef.current.removeChild(tickGRef.current.firstChild);
      }
      ticks.forEach((t) => { if (t) t.style.display = "none"; });
      return;
    }
    const count = tickCount;
    const majorAngles = Array.from({ length: count }, (_, i) => {
      const val = tickPositions?.[i] ?? (count <= 1 ? displayMin : displayMin + (i / (count - 1)) * (displayMax - displayMin));
      return gaugePositionDeg(val, displayMin, displayMax, sweep);
    });
    if (tickGRef.current) drawTickLines(tickGRef.current, majorAngles, 200, 200, subTicks);
    for (let i = 0; i < MAX_TICKS; i++) {
      const t = ticks[i];
      if (!t) continue;
      if (i < count) {
        // In full-sweep mode, first and last tick overlap — hide first label
        if (fullSweep && i === 0 && count > 1) {
          t.style.display = "none";
          continue;
        }
        const rad = (majorAngles[i]! * Math.PI) / 180;
        t.style.left    = `${((200 + 107 * Math.cos(rad)) / 400 * 100).toFixed(3)}%`;
        t.style.top     = `${((200 + 107 * Math.sin(rad)) / 400 * 100).toFixed(3)}%`;
        const autoVal   = tickPositions?.[i] ?? (count <= 1 ? displayMin : displayMin + (i / (count - 1)) * (displayMax - displayMin));
        t.textContent   = tickLabels?.[i] ?? autoVal.toFixed(tickPrecision);
        t.style.display = "";
      } else {
        t.style.display = "none";
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickCount, displayMin, displayMax, tickPrecision, subTicks, tickLabelsKey, tickPositionsKey, fullSweep, sweep]);

  return <div ref={containerRef} />;
}

import { ReactElement, useEffect, useRef } from "react";

import { ensureCss } from "../BundledFlightIndicators";
import dualTachometerMechanicsRaw from "../assets/instruments/dual_tachometer_mechanics.svg?raw";
import dualTachometerNeedleRaw from "../assets/instruments/dual_tachometer_needle.svg?raw";
import fiCircleRaw from "../assets/instruments/fi_circle.svg?raw";

function toDataUrl(svgRaw: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgRaw)}`;
}

// Mirror an SVG horizontally around x=200 (centre of the 400×400 viewBox).
// The transform scale(-1,1) translate(-400,0) maps x → 400−x.
// Used to derive the R needle from the single E needle source.
function mirrorSvgX(svgRaw: string): string {
  return svgRaw.replace(
    /(<svg[^>]*>)([\s\S]*)(<\/svg>\s*$)/,
    (_, open, body, close) =>
      `${open}<g transform="scale(-1,1) translate(-400,0)">${body}</g>${close}`,
  );
}

const FACE_URL     = toDataUrl(dualTachometerMechanicsRaw);
const NEEDLE_E_URL = toDataUrl(dualTachometerNeedleRaw);
const NEEDLE_R_URL = toDataUrl(mirrorSvgX(dualTachometerNeedleRaw));
const CIRCLE_URL   = toDataUrl(fiCircleRaw);

// Dual tachometer: 50–110 % RPM, 90° sweep per side.
//
// Needle SVGs: 400×400 canvas.
//   E needle (dual_tachometer_needle.svg):   arm points RIGHT from x=50 (pivot at 12.5%).
//   R needle (dual_tachometer_needle_r.svg): arm points LEFT  from x=350 (pivot at 87.5%),
//             geometrically mirrored — no CSS transform on the img needed.
//
// Rotation formula:
//   E:  rot = (80 − clamped) × 1.5
//   R:  rot = (clamped − 80) × 1.5  ← negated because a leftward arm under CSS
//       rotate() moves its tip OPPOSITE to a rightward arm.
//
//   50%  → E: +45°, R: −45°  (both tips point downward, "V" at bottom)
//   80%  → both 0°           (horizontal, pointing at each other)
//  110%  → E: −45°, R: +45°  (both tips point upward, "V" at top)
//
// fi_circle.svg bezel: inner circle r=150 from SVG centre (200,200).
//   At 12.5% from each edge, this ring overlaps and hides the dark needle base.

const MIN_PCT = 50;
const MAX_PCT = 110;

type Props = { enginePct: number | undefined; rotorPct: number | undefined; size: string };

export function DualTachometer({ enginePct, rotorPct, size }: Props): ReactElement {
  const containerRef    = useRef<HTMLDivElement>(null);
  const engineNeedleRef = useRef<HTMLDivElement | null>(null);
  const rotorNeedleRef  = useRef<HTMLDivElement | null>(null);

  // Build DOM once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    ensureCss();

    const instrument = document.createElement("div");
    instrument.className = "instrument dual-tachometer";

    // ── Face ──────────────────────────────────────────────────────────────
    const face = document.createElement("img");
    face.className = "box";
    face.src = FACE_URL;
    instrument.appendChild(face);

    // ── Engine needle (E) ─────────────────────────────────────────────────
    // Full-size div, pivot = left edge centre (0%, 50%).
    // Initial rotation: 50% RPM → rotate(+45deg).
    const eNeedleDiv = document.createElement("div");
    eNeedleDiv.className = "box";
    eNeedleDiv.style.transformOrigin = "12.5% 50%"; // inner edge of fi_circle.svg bezel (r=150/400=12.5%)
    eNeedleDiv.style.transform       = "rotate(45deg)";
    const eNeedleImg = document.createElement("img");
    eNeedleImg.className = "box";
    eNeedleImg.src = NEEDLE_E_URL;
    eNeedleDiv.appendChild(eNeedleImg);
    instrument.appendChild(eNeedleDiv);

    // ── Rotor needle (R) ──────────────────────────────────────────────────
    // Full-size div, pivot = right edge centre (87.5%, 50%).
    // Uses dual_tachometer_needle_r.svg whose arm points left by geometry,
    // so no CSS transform on the img is needed.
    // Initial rotation: 50% RPM → rotate(-45deg) (leftward arm, tip down).
    const rNeedleDiv = document.createElement("div");
    rNeedleDiv.className = "box";
    rNeedleDiv.style.transformOrigin = "87.5% 50%"; // inner edge of fi_circle.svg bezel (mirror of E)
    rNeedleDiv.style.transform       = "rotate(-45deg)";
    const rNeedleImg = document.createElement("img");
    rNeedleImg.className = "box";
    rNeedleImg.src = NEEDLE_R_URL;
    rNeedleDiv.appendChild(rNeedleImg);
    instrument.appendChild(rNeedleDiv);

    // ── Bezel overlay (fi_circle.svg) ─────────────────────────────────────
    // Rendered last so it appears on top of needles.
    // The inner ring (r=150 from SVG centre) sits at 12.5% from each edge,
    // naturally hiding the dark needle base.
    const circleDiv = document.createElement("div");
    circleDiv.className = "mechanics box";
    const circleImg = document.createElement("img");
    circleImg.className = "box";
    circleImg.src = CIRCLE_URL;
    circleDiv.appendChild(circleImg);
    instrument.appendChild(circleDiv);

    el.appendChild(instrument);
    engineNeedleRef.current = eNeedleDiv;
    rotorNeedleRef.current  = rNeedleDiv;

    return () => {
      el.innerHTML = "";
      engineNeedleRef.current = null;
      rotorNeedleRef.current  = null;
    };
  }, []);

  // ── Resize ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const n = parseInt(size, 10);
    if (!isNaN(n)) {
      const instrument = containerRef.current?.querySelector<HTMLElement>(".instrument");
      if (instrument) {
        instrument.style.width  = `${n}px`;
        instrument.style.height = `${n}px`;
      }
    }
  }, [size]);

  // ── Engine needle update: rot = (80 − pct) × 1.5 ─────────────────────────
  useEffect(() => {
    if (enginePct == null || !engineNeedleRef.current) return;
    const clamped = Math.max(MIN_PCT, Math.min(MAX_PCT, enginePct));
    const rot = (80 - clamped) * 1.5;
    engineNeedleRef.current.style.transform = `rotate(${rot}deg)`;
  }, [enginePct]);

  // ── Rotor needle update: rot = (pct − 80) × 1.5 ──────────────────────────
  // Negated because the leftward-arm R needle rotates in the opposite visual
  // direction to the rightward-arm E needle for the same CSS rotate() value.
  useEffect(() => {
    if (rotorPct == null || !rotorNeedleRef.current) return;
    const clamped = Math.max(MIN_PCT, Math.min(MAX_PCT, rotorPct));
    const rot = (clamped - 80) * 1.5;
    rotorNeedleRef.current.style.transform = `rotate(${rot}deg)`;
  }, [rotorPct]);

  return <div ref={containerRef} />;
}

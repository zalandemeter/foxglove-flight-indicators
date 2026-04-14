import { PanelExtensionContext } from "@foxglove/extension";

import gaugeMechanicsRaw from "../assets/instruments/gauge_mechanics.svg?raw";
import { toDataUrl } from "../utils";
import { GaugeConfig, createGaugePanel } from "./GaugePanel";

const FACE_URL = toDataUrl(gaugeMechanicsRaw);

const airspeedDefaults: GaugeConfig = {
  valuePath: "",
  normalize: false,
  min: 0,
  max: 160,
  normalizeOutputMin: 0,
  normalizeOutputMax: 100,
  expr: "",
  clampMin: 0,
  clampMax: 160,
  tickCount: 9,
  tickPrecision: 0,
  subTicks: "detailed",
  tickLabelsStr: "",
  tickPositionsStr: "",
  fullSweep: false,
  zoneCount: 3,
  zone1Start: 40,  zone1End: 120, zone1Color: "#008000",
  zone2Start: 120, zone2End: 140, zone2Color: "#ffff00",
  zone3Start: 140, zone3End: 160, zone3Color: "#ff0000",
  zone4Start: 0, zone4End: 0, zone4Color: "#ffffff",
  zone5Start: 0, zone5End: 0, zone5Color: "#ffffff",
  zone6Start: 0, zone6End: 0, zone6Color: "#ffffff",
  zone7Start: 0, zone7End: 0, zone7Color: "#ffffff",
  topLabel: "AIRSPEED",
  bottomLabel: "KM/H",
};

export function initAirspeedPanel(context: PanelExtensionContext): () => void {
  return createGaugePanel(airspeedDefaults, FACE_URL)(context);
}

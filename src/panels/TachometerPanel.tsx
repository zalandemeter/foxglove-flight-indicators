import { PanelExtensionContext } from "@foxglove/extension";

import gaugeMechanicsRaw from "../assets/instruments/gauge_mechanics.svg?raw";
import { toDataUrl } from "../utils";
import { GaugeConfig, createGaugePanel } from "./GaugePanel";

const FACE_URL = toDataUrl(gaugeMechanicsRaw);

const tachometerDefaults: GaugeConfig = {
  valuePath: "",
  normalize: false,
  min: 0,
  max: 8000,
  normalizeOutputMin: 0,
  normalizeOutputMax: 100,
  expr: "",
  clampMin: 0,
  clampMax: 8000,
  tickCount: 9,
  tickPrecision: 0,
  subTicks: "simple",
  tickLabelsStr: "0,1,2,3,4,5,6,7,8",
  tickPositionsStr: "",
  fullSweep: false,
  zoneCount: 3,
  zone1Start: 0,    zone1End: 6000, zone1Color: "#008000",
  zone2Start: 6000, zone2End: 7000, zone2Color: "#ffff00",
  zone3Start: 7000, zone3End: 8000, zone3Color: "#ff0000",
  zone4Start: 0, zone4End: 0, zone4Color: "#ffffff",
  zone5Start: 0, zone5End: 0, zone5Color: "#ffffff",
  zone6Start: 0, zone6End: 0, zone6Color: "#ffffff",
  zone7Start: 0, zone7End: 0, zone7Color: "#ffffff",
  topLabel: "RPM",
  bottomLabel: "x 1000",
  staleCheck: true,
};

export function initTachometerPanel(context: PanelExtensionContext): () => void {
  return createGaugePanel(tachometerDefaults, FACE_URL)(context);
}

import { PanelExtensionContext, SettingsTreeAction, SettingsTreeNodes } from "@foxglove/extension";
import { ReactElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { Gauge } from "../instruments/Gauge";
import {
  ZoneConfig, MAX_ZONES, SubTickMode,
  buildZones, makeZoneChildren,
  parseTickLabels, parseTickPositions,
  exprError, applyExpr,
  tickLabelsError, tickPositionsError,
} from "../gaugeShared";
import { useInstrumentPanel } from "../useInstrumentPanel";
import { toDataUrl } from "../utils";
import gaugeMechanicsRaw from "../assets/instruments/gauge_mechanics.svg?raw";

const DEFAULT_FACE_URL = toDataUrl(gaugeMechanicsRaw);

export type GaugeConfig = {
  valuePath: string;
  normalize: boolean;
  min: number;
  max: number;
  normalizeOutputMin: number;
  normalizeOutputMax: number;
  expr: string;
  clampMin: number;
  clampMax: number;
  tickCount: number;
  tickPrecision: number;
  subTicks: string;
  tickLabelsStr: string;
  tickPositionsStr: string;
  zoneCount: number;
  zone1Start: number; zone1End: number; zone1Color: string;
  zone2Start: number; zone2End: number; zone2Color: string;
  zone3Start: number; zone3End: number; zone3Color: string;
  zone4Start: number; zone4End: number; zone4Color: string;
  zone5Start: number; zone5End: number; zone5Color: string;
  zone6Start: number; zone6End: number; zone6Color: string;
  zone7Start: number; zone7End: number; zone7Color: string;
  fullSweep: boolean;
  topLabel: string;
  bottomLabel: string;
};

const numericKeys = new Set<keyof GaugeConfig>([
  "min", "max", "normalizeOutputMin", "normalizeOutputMax",
  "clampMin", "clampMax",
  "tickCount", "tickPrecision",
  "zoneCount",
  "zone1Start", "zone1End",
  "zone2Start", "zone2End",
  "zone3Start", "zone3End",
  "zone4Start", "zone4End",
  "zone5Start", "zone5End",
  "zone6Start", "zone6End",
  "zone7Start", "zone7End",
]);
const boolKeys = new Set<keyof GaugeConfig>(["normalize", "fullSweep"]);

function GaugePanelImpl({
  context,
  defaultConfig,
  faceUrl,
}: {
  context: PanelExtensionContext;
  defaultConfig: GaugeConfig;
  faceUrl: string;
}): ReactElement {
  const [config, setConfig] = useState<GaugeConfig>(() => {
    const saved = (context.initialState ?? {}) as Partial<GaugeConfig>;
    const base = { ...defaultConfig, ...saved };
    context.saveState(base);
    return base;
  });

  const { getValue, containerRef, size } = useInstrumentPanel(context, [config.valuePath]);

  const rawValue    = getValue(config.valuePath);
  const transformed = rawValue != null ? applyExpr(rawValue, config.expr) : undefined;
  const value       = transformed != null
    ? config.normalize
      ? config.normalizeOutputMin + ((transformed - config.min) / (config.max - config.min)) * (config.normalizeOutputMax - config.normalizeOutputMin)
      : transformed
    : undefined;

  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: (action: SettingsTreeAction) => {
        if (action.action === "update") {
          const { path, value: v } = action.payload;
          const key = path[path.length - 1] as keyof GaugeConfig;
          setConfig((prev) => {
            const next = {
              ...prev,
              [key]: numericKeys.has(key)
                ? Number(v)
                : boolKeys.has(key)
                ? Boolean(v)
                : String(v),
            };
            context.saveState(next);
            return next;
          });
        }
      },
      nodes: {
        general: {
          label: "General",
          defaultExpansionState: "expanded",
          fields: {
            valuePath: { label: "Value", input: "messagepath", value: config.valuePath },
          },
        },
        data: {
          label: "Data",
          defaultExpansionState: "collapsed",
          error: exprError(config.expr)
            ?? ((config.normalize && config.max <= config.min)
            ? "Input max must be greater than input min"
            : (config.normalize && config.normalizeOutputMax <= config.normalizeOutputMin)
            ? "Output max must be greater than output min"
            : (config.clampMax <= config.clampMin)
            ? "Clamp max must be greater than clamp min"
            : undefined),
          fields: {
            clampMin:  { label: "Clamp min", input: "number", value: config.clampMin },
            clampMax:  { label: "Clamp max", input: "number", value: config.clampMax },
            normalize: { label: "Enable normalization", input: "boolean", value: config.normalize },
            ...(config.normalize ? {
              min:                { label: "Input min",  input: "number", value: config.min },
              max:                { label: "Input max",  input: "number", value: config.max },
              normalizeOutputMin: { label: "Output min", input: "number", value: config.normalizeOutputMin },
              normalizeOutputMax: { label: "Output max", input: "number", value: config.normalizeOutputMax },
            } : {}),
            expr: { label: "Expression (x=input, empty=off)", input: "string", value: config.expr },
          },
        },
        display: {
          label: "Display",
          defaultExpansionState: "collapsed",
          error: tickPositionsError(config.tickPositionsStr, config.tickCount)
            ?? tickLabelsError(config.tickLabelsStr, config.tickCount),
          fields: {
            fullSweep:        { label: "Full circle",                      input: "boolean", value: config.fullSweep },
            tickCount:        { label: "Tick count",                       input: "number",  value: config.tickCount,     min: 0, max: 20, step: 1 },
            subTicks:         { label: "Sub-ticks", input: "select", value: config.subTicks, options: [
              { label: "None", value: "none" },
              { label: "Simple", value: "simple" },
              { label: "Detailed", value: "detailed" },
            ] },
            tickPrecision:    { label: "Tick precision",                   input: "number",  value: config.tickPrecision, min: 0, max: 3,  step: 1 },
            tickPositionsStr: { label: "Tick positions (csv, empty=auto)", input: "string",  value: config.tickPositionsStr },
            tickLabelsStr:    { label: "Tick labels (csv, empty=auto)",    input: "string",  value: config.tickLabelsStr },
            zoneCount:        { label: "Zone count",                       input: "number",  value: config.zoneCount,     min: 0, max: MAX_ZONES, step: 1 },
          },
          children: makeZoneChildren("zone", config.zoneCount, config as ZoneConfig),
        },
        labels: {
          label: "Labels",
          defaultExpansionState: "collapsed",
          fields: {
            topLabel:    { label: "Top",    input: "string", value: config.topLabel },
            bottomLabel: { label: "Bottom", input: "string", value: config.bottomLabel },
          },
        },
      } as SettingsTreeNodes,
    });
  }, [context, config]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
      }}
    >
      <Gauge
        value={value}
        size={size}
        faceUrl={faceUrl}
        displayMin={config.clampMin}
        displayMax={config.clampMax}
        clamp={true}
        clampMin={config.clampMin}
        clampMax={config.clampMax}
        tickCount={config.tickCount}
        tickPrecision={config.tickPrecision}
        subTicks={config.subTicks as SubTickMode}
        tickLabels={parseTickLabels(config.tickLabelsStr, config.tickCount)}
        tickPositions={parseTickPositions(config.tickPositionsStr, config.tickCount)}
        zones={buildZones(config as ZoneConfig, "zone", config.zoneCount)}
        topLabel={config.topLabel}
        bottomLabel={config.bottomLabel}
        fullSweep={config.fullSweep}
      />
    </div>
  );
}

export function createGaugePanel(
  defaultConfig: GaugeConfig,
  faceUrl: string,
): (context: PanelExtensionContext) => () => void {
  return function initPanel(context: PanelExtensionContext): () => void {
    const root = createRoot(context.panelElement);
    root.render(
      <GaugePanelImpl context={context} defaultConfig={defaultConfig} faceUrl={faceUrl} />,
    );
    return () => { root.unmount(); };
  };
}

const generalDefaults: GaugeConfig = {
  valuePath: "",
  normalize: false,
  min: 0,
  max: 100,
  normalizeOutputMin: 0,
  normalizeOutputMax: 100,
  expr: "",
  clampMin: 0,
  clampMax: 100,
  tickCount: 11,
  tickPrecision: 0,
  subTicks: "simple",
  tickLabelsStr: "",
  tickPositionsStr: "",
  fullSweep: true,
  zoneCount: 0,
  zone1Start: 0, zone1End: 0, zone1Color: "#ffffff",
  zone2Start: 0, zone2End: 0, zone2Color: "#ffffff",
  zone3Start: 0, zone3End: 0, zone3Color: "#ffffff",
  zone4Start: 0, zone4End: 0, zone4Color: "#ffffff",
  zone5Start: 0, zone5End: 0, zone5Color: "#ffffff",
  zone6Start: 0, zone6End: 0, zone6Color: "#ffffff",
  zone7Start: 0, zone7End: 0, zone7Color: "#ffffff",
  topLabel: "GAUGE",
  bottomLabel: "UNIT",
};

export const initGaugePanel = createGaugePanel(generalDefaults, DEFAULT_FACE_URL);

import { PanelExtensionContext, SettingsTreeAction, SettingsTreeNodes } from "@foxglove/extension";
import { ReactElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { DualGauge } from "../instruments/DualGauge";
import {
  ZoneConfig, MAX_ZONES, SubTickMode,
  buildZones, makeZoneChildren,
  parseTickLabels, parseTickPositions,
  exprError, applyExpr,
  tickLabelsError, tickPositionsError, bottomLabelError,
} from "../gaugeShared";
import { useInstrumentPanel } from "../useInstrumentPanel";

export type Config = {
  leftPath: string;
  rightPath: string;
  leftNormalize: boolean;
  leftMin: number;
  leftMax: number;
  leftNormalizeOutputMin: number;
  leftNormalizeOutputMax: number;
  rightNormalize: boolean;
  rightMin: number;
  rightMax: number;
  rightNormalizeOutputMin: number;
  rightNormalizeOutputMax: number;
  leftExpr: string;
  rightExpr: string;
  leftClampMin: number;
  leftClampMax: number;
  leftTickCount: number;
  leftTickPrecision: number;
  leftSubTicks: string;
  rightClampMin: number;
  rightClampMax: number;
  rightTickCount: number;
  rightTickPrecision: number;
  rightSubTicks: string;
  topLabel: string;
  bottomLabel: string;
  leftLabel: string;
  rightLabel: string;
  leftLabelVertical: boolean;
  rightLabelVertical: boolean;
  leftTickLabelsStr: string;
  leftTickPositionsStr: string;
  rightTickLabelsStr: string;
  rightTickPositionsStr: string;
  leftZoneCount: number;
  leftZone1Start: number; leftZone1End: number; leftZone1Color: string;
  leftZone2Start: number; leftZone2End: number; leftZone2Color: string;
  leftZone3Start: number; leftZone3End: number; leftZone3Color: string;
  leftZone4Start: number; leftZone4End: number; leftZone4Color: string;
  leftZone5Start: number; leftZone5End: number; leftZone5Color: string;
  leftZone6Start: number; leftZone6End: number; leftZone6Color: string;
  leftZone7Start: number; leftZone7End: number; leftZone7Color: string;
  rightZoneCount: number;
  rightZone1Start: number; rightZone1End: number; rightZone1Color: string;
  rightZone2Start: number; rightZone2End: number; rightZone2Color: string;
  rightZone3Start: number; rightZone3End: number; rightZone3Color: string;
  rightZone4Start: number; rightZone4End: number; rightZone4Color: string;
  rightZone5Start: number; rightZone5End: number; rightZone5Color: string;
  rightZone6Start: number; rightZone6End: number; rightZone6Color: string;
  rightZone7Start: number; rightZone7End: number; rightZone7Color: string;
};

const numericKeys = new Set<keyof Config>([
  "leftMin", "leftMax", "leftNormalizeOutputMin", "leftNormalizeOutputMax",
  "rightMin", "rightMax", "rightNormalizeOutputMin", "rightNormalizeOutputMax",
  "leftClampMin", "leftClampMax", "leftTickCount", "leftTickPrecision",
  "rightClampMin", "rightClampMax", "rightTickCount", "rightTickPrecision",
  "leftZoneCount", "rightZoneCount",
  "leftZone1Start", "leftZone1End", "leftZone2Start", "leftZone2End",
  "leftZone3Start", "leftZone3End", "leftZone4Start", "leftZone4End", "leftZone5Start", "leftZone5End",
  "leftZone6Start", "leftZone6End", "leftZone7Start", "leftZone7End",
  "rightZone1Start", "rightZone1End", "rightZone2Start", "rightZone2End",
  "rightZone3Start", "rightZone3End", "rightZone4Start", "rightZone4End", "rightZone5Start", "rightZone5End",
  "rightZone6Start", "rightZone6End", "rightZone7Start", "rightZone7End",
]);
const boolKeys = new Set<keyof Config>(["leftNormalize", "rightNormalize", "leftLabelVertical", "rightLabelVertical"]);

function DualGaugePanelImpl({
  context,
  defaultConfig,
}: {
  context: PanelExtensionContext;
  defaultConfig: Config;
}): ReactElement {
  const [config, setConfig] = useState<Config>(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));

  const { getValue, containerRef, size } = useInstrumentPanel(context, [
    config.leftPath,
    config.rightPath,
  ]);

  const leftRaw  = getValue(config.leftPath);
  const rightRaw = getValue(config.rightPath);

  const leftTransformed  = leftRaw  != null ? applyExpr(leftRaw,  config.leftExpr)  : undefined;
  const rightTransformed = rightRaw != null ? applyExpr(rightRaw, config.rightExpr) : undefined;

  const leftPct = leftTransformed != null
    ? config.leftNormalize
      ? config.leftNormalizeOutputMin + ((leftTransformed - config.leftMin) / (config.leftMax - config.leftMin)) * (config.leftNormalizeOutputMax - config.leftNormalizeOutputMin)
      : leftTransformed
    : undefined;

  const rightPct = rightTransformed != null
    ? config.rightNormalize
      ? config.rightNormalizeOutputMin + ((rightTransformed - config.rightMin) / (config.rightMax - config.rightMin)) * (config.rightNormalizeOutputMax - config.rightNormalizeOutputMin)
      : rightTransformed
    : undefined;

  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: (action: SettingsTreeAction) => {
        if (action.action === "update") {
          const { path, value } = action.payload;
          const key = path[path.length - 1] as keyof Config;
          setConfig((prev) => {
            const next = {
              ...prev,
              [key]: numericKeys.has(key)
                ? Number(value)
                : boolKeys.has(key)
                ? Boolean(value)
                : String(value),
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
            leftPath:  { label: "Left topic",  input: "messagepath", value: config.leftPath },
            rightPath: { label: "Right topic", input: "messagepath", value: config.rightPath },
          },
        },
        left: {
          label: "Left gauge",
          defaultExpansionState: "collapsed",
          error: (config.leftNormalize && config.leftMax <= config.leftMin)
            ? "Input max must be greater than input min"
            : (config.leftNormalize && config.leftNormalizeOutputMax <= config.leftNormalizeOutputMin)
            ? "Output max must be greater than output min"
            : (config.leftClampMax <= config.leftClampMin)
            ? "Clamp max must be greater than clamp min"
            : tickLabelsError(config.leftTickLabelsStr, config.leftTickCount),
          children: {
            leftData: {
              label: "Data",
              defaultExpansionState: "collapsed",
              error: exprError(config.leftExpr)
                ?? ((config.leftNormalize && config.leftMax <= config.leftMin)
                ? "Input max must be greater than input min"
                : (config.leftNormalize && config.leftNormalizeOutputMax <= config.leftNormalizeOutputMin)
                ? "Output max must be greater than output min"
                : (config.leftClampMax <= config.leftClampMin)
                ? "Clamp max must be greater than clamp min"
                : undefined),
              fields: {
                leftClampMin: { label: "Clamp min", input: "number", value: config.leftClampMin },
                leftClampMax: { label: "Clamp max", input: "number", value: config.leftClampMax },
                leftNormalize:          { label: "Enable normalization", input: "boolean", value: config.leftNormalize },
                ...(config.leftNormalize ? {
                  leftMin:                { label: "Input min",  input: "number", value: config.leftMin },
                  leftMax:                { label: "Input max",  input: "number", value: config.leftMax },
                  leftNormalizeOutputMin: { label: "Output min", input: "number", value: config.leftNormalizeOutputMin },
                  leftNormalizeOutputMax: { label: "Output max", input: "number", value: config.leftNormalizeOutputMax },
                } : {}),
                leftExpr:               { label: "Expression (x=input, empty=off)", input: "string", value: config.leftExpr },
              },
            },
            leftDisplay: {
              label: "Display",
              defaultExpansionState: "collapsed",
              error: tickPositionsError(config.leftTickPositionsStr, config.leftTickCount)
                ?? tickLabelsError(config.leftTickLabelsStr, config.leftTickCount),
              fields: {
                leftTickCount:        { label: "Tick count",                        input: "number",  value: config.leftTickCount,        min: 2, max: 10, step: 1 },
                leftSubTicks:         { label: "Sub-ticks", input: "select", value: config.leftSubTicks, options: [
                  { label: "None", value: "none" }, { label: "Simple", value: "simple" }, { label: "Detailed", value: "detailed" },
                ] },
                leftTickPrecision:    { label: "Tick precision",                    input: "number",  value: config.leftTickPrecision,    min: 0, max: 3,  step: 1 },
                leftTickPositionsStr: { label: "Tick positions (csv, empty=auto)",  input: "string", value: config.leftTickPositionsStr },
                leftTickLabelsStr:    { label: "Tick labels (csv, empty=auto)",     input: "string", value: config.leftTickLabelsStr },
                leftZoneCount:        { label: "Zone count",                        input: "number", value: config.leftZoneCount,        min: 0, max: MAX_ZONES, step: 1 },
              },
              children: makeZoneChildren("leftZone", config.leftZoneCount, config as ZoneConfig),
            },
          },
        },
        right: {
          label: "Right gauge",
          defaultExpansionState: "collapsed",
          error: (config.rightNormalize && config.rightMax <= config.rightMin)
            ? "Input max must be greater than input min"
            : (config.rightNormalize && config.rightNormalizeOutputMax <= config.rightNormalizeOutputMin)
            ? "Output max must be greater than output min"
            : (config.rightClampMax <= config.rightClampMin)
            ? "Clamp max must be greater than clamp min"
            : tickLabelsError(config.rightTickLabelsStr, config.rightTickCount),
          children: {
            rightData: {
              label: "Data",
              defaultExpansionState: "collapsed",
              error: exprError(config.rightExpr)
                ?? ((config.rightNormalize && config.rightMax <= config.rightMin)
                ? "Input max must be greater than input min"
                : (config.rightNormalize && config.rightNormalizeOutputMax <= config.rightNormalizeOutputMin)
                ? "Output max must be greater than output min"
                : (config.rightClampMax <= config.rightClampMin)
                ? "Clamp max must be greater than clamp min"
                : undefined),
              fields: {
                rightClampMin: { label: "Clamp min", input: "number", value: config.rightClampMin },
                rightClampMax: { label: "Clamp max", input: "number", value: config.rightClampMax },
                rightNormalize:          { label: "Enable normalization", input: "boolean", value: config.rightNormalize },
                ...(config.rightNormalize ? {
                  rightMin:                { label: "Input min",  input: "number", value: config.rightMin },
                  rightMax:                { label: "Input max",  input: "number", value: config.rightMax },
                  rightNormalizeOutputMin: { label: "Output min", input: "number", value: config.rightNormalizeOutputMin },
                  rightNormalizeOutputMax: { label: "Output max", input: "number", value: config.rightNormalizeOutputMax },
                } : {}),
                rightExpr:               { label: "Expression (x=input, empty=off)", input: "string", value: config.rightExpr },
              },
            },
            rightDisplay: {
              label: "Display",
              defaultExpansionState: "collapsed",
              error: tickPositionsError(config.rightTickPositionsStr, config.rightTickCount)
                ?? tickLabelsError(config.rightTickLabelsStr, config.rightTickCount),
              fields: {
                rightTickCount:        { label: "Tick count",                        input: "number",  value: config.rightTickCount,        min: 2, max: 10, step: 1 },
                rightSubTicks:         { label: "Sub-ticks", input: "select", value: config.rightSubTicks, options: [
                  { label: "None", value: "none" }, { label: "Simple", value: "simple" }, { label: "Detailed", value: "detailed" },
                ] },
                rightTickPrecision:    { label: "Tick precision",                    input: "number",  value: config.rightTickPrecision,    min: 0, max: 3,  step: 1 },
                rightTickPositionsStr: { label: "Tick positions (csv, empty=auto)",  input: "string", value: config.rightTickPositionsStr },
                rightTickLabelsStr:    { label: "Tick labels (csv, empty=auto)",     input: "string", value: config.rightTickLabelsStr },
                rightZoneCount:        { label: "Zone count",                        input: "number", value: config.rightZoneCount,        min: 0, max: MAX_ZONES, step: 1 },
              },
              children: makeZoneChildren("rightZone", config.rightZoneCount, config as ZoneConfig),
            },
          },
        },
        labels: {
          label: "Labels",
          defaultExpansionState: "collapsed",
          error: bottomLabelError(config.bottomLabel),
          fields: {
            topLabel:    { label: "Top",    input: "string", value: config.topLabel },
            bottomLabel: { label: "Bottom (csv, max 2)", input: "string", value: config.bottomLabel },
            leftLabel:         { label: "Left",             input: "string",  value: config.leftLabel },
            leftLabelVertical: { label: "Left vertical",   input: "boolean", value: config.leftLabelVertical },
            rightLabel:        { label: "Right",            input: "string",  value: config.rightLabel },
            rightLabelVertical:{ label: "Right vertical",  input: "boolean", value: config.rightLabelVertical },
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
      <DualGauge
        leftPct={leftPct}
        rightPct={rightPct}
        size={size}
        topLabel={config.topLabel}
        bottomLabel={config.bottomLabel}
        leftLabel={config.leftLabel}
        leftLabelVertical={config.leftLabelVertical}
        rightLabel={config.rightLabel}
        rightLabelVertical={config.rightLabelVertical}
        leftDisplayMin={config.leftClampMin}
        leftDisplayMax={config.leftClampMax}
        leftClamp={true}
        leftClampMin={config.leftClampMin}
        leftClampMax={config.leftClampMax}
        leftTickCount={config.leftTickCount}
        leftSubTicks={config.leftSubTicks as SubTickMode}
        leftTickPrecision={config.leftTickPrecision}
        leftTickLabels={parseTickLabels(config.leftTickLabelsStr, config.leftTickCount)}
        leftTickPositions={parseTickPositions(config.leftTickPositionsStr, config.leftTickCount)}
        leftZones={buildZones(config as ZoneConfig, "leftZone", config.leftZoneCount)}
        rightDisplayMin={config.rightClampMin}
        rightDisplayMax={config.rightClampMax}
        rightClamp={true}
        rightClampMin={config.rightClampMin}
        rightClampMax={config.rightClampMax}
        rightTickCount={config.rightTickCount}
        rightSubTicks={config.rightSubTicks as SubTickMode}
        rightTickPrecision={config.rightTickPrecision}
        rightTickLabels={parseTickLabels(config.rightTickLabelsStr, config.rightTickCount)}
        rightTickPositions={parseTickPositions(config.rightTickPositionsStr, config.rightTickCount)}
        rightZones={buildZones(config as ZoneConfig, "rightZone", config.rightZoneCount)}
      />
    </div>
  );
}

export function createDualGaugePanel(
  defaultConfig: Config,
): (context: PanelExtensionContext) => () => void {
  return function initPanel(context: PanelExtensionContext): () => void {
    const root = createRoot(context.panelElement);
    root.render(<DualGaugePanelImpl context={context} defaultConfig={defaultConfig} />);
    return () => {
      root.unmount();
    };
  };
}

const generalDefaults: Config = {
  leftPath: "",
  rightPath: "",
  leftNormalize: false,
  leftMin: 0,
  leftMax: 100,
  leftNormalizeOutputMin: 0,
  leftNormalizeOutputMax: 100,
  leftExpr: "",
  rightNormalize: false,
  rightMin: 0,
  rightMax: 100,
  rightNormalizeOutputMin: 0,
  rightNormalizeOutputMax: 100,
  rightExpr: "",
  leftClampMin: 0,
  leftClampMax: 100,
  leftTickCount: 5,
  leftTickPrecision: 0,
  leftSubTicks: "simple",
  rightClampMin: 0,
  rightClampMax: 100,
  rightTickCount: 5,
  rightTickPrecision: 0,
  rightSubTicks: "simple",
  topLabel: "GAUGE",
  bottomLabel: "UNIT",
  leftLabel: "LEFT",
  rightLabel: "RIGHT",
  leftLabelVertical: true,
  rightLabelVertical: true,
  leftTickLabelsStr: "",
  leftTickPositionsStr: "",
  rightTickLabelsStr: "",
  rightTickPositionsStr: "",
  leftZoneCount: 0,
  leftZone1Start: 0,  leftZone1End: 0,  leftZone1Color: "#ffffff",
  leftZone2Start: 0,  leftZone2End: 0,  leftZone2Color: "#ffffff",
  leftZone3Start: 0,  leftZone3End: 0,  leftZone3Color: "#ffffff",
  leftZone4Start: 0,  leftZone4End: 0,  leftZone4Color: "#ffffff",
  leftZone5Start: 0,  leftZone5End: 0,  leftZone5Color: "#ffffff",
  leftZone6Start: 0,  leftZone6End: 0,  leftZone6Color: "#ffffff",
  leftZone7Start: 0,  leftZone7End: 0,  leftZone7Color: "#ffffff",
  rightZoneCount: 0,
  rightZone1Start: 0, rightZone1End: 0, rightZone1Color: "#ffffff",
  rightZone2Start: 0, rightZone2End: 0, rightZone2Color: "#ffffff",
  rightZone3Start: 0, rightZone3End: 0, rightZone3Color: "#ffffff",
  rightZone4Start: 0, rightZone4End: 0, rightZone4Color: "#ffffff",
  rightZone5Start: 0, rightZone5End: 0, rightZone5Color: "#ffffff",
  rightZone6Start: 0, rightZone6End: 0, rightZone6Color: "#ffffff",
  rightZone7Start: 0, rightZone7End: 0, rightZone7Color: "#ffffff",
};

export const initDualGaugePanel = createDualGaugePanel(generalDefaults);

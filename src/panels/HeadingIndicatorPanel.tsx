import { PanelExtensionContext, SettingsTreeAction, SettingsTreeNodes } from "@foxglove/extension";
import { ReactElement, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { HeadingIndicator } from "../instruments/HeadingIndicator";
import { applyExpr, exprError } from "../instrumentShared";
import { STALE_STYLE, useInstrumentPanel } from "../useInstrumentPanel";

type InputMode = "scalar" | "quaternion";
type Unit = "deg" | "rad";

type Config = {
  inputMode: InputMode;
  headingPath: string;
  unit: Unit;
  qxPath: string;
  qyPath: string;
  qzPath: string;
  qwPath: string;
  expr: string;
  staleCheck: boolean;
};

const defaultConfig: Config = {
  inputMode: "scalar",
  headingPath: "",
  unit: "deg",
  qxPath: "",
  qyPath: "",
  qzPath: "",
  qwPath: "",
  expr: "",
  staleCheck: true,
};

const boolKeys = new Set<keyof Config>(["staleCheck"]);

function HeadingIndicatorPanel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [config, setConfig] = useState<Config>(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));

  const paths = useMemo(
    () =>
      config.inputMode === "scalar"
        ? [config.headingPath]
        : [config.qxPath, config.qyPath, config.qzPath, config.qwPath],
    [config.inputMode, config.headingPath, config.qxPath, config.qyPath, config.qzPath, config.qwPath],
  );

  const { getValue, isStale, containerRef, size } = useInstrumentPanel(context, paths);

  let angleDeg: number | undefined;
  if (config.inputMode === "scalar") {
    const raw = getValue(config.headingPath);
    if (raw != null) {
      angleDeg = config.unit === "rad" ? (raw * 180) / Math.PI : raw;
    }
  } else {
    const x = getValue(config.qxPath);
    const y = getValue(config.qyPath);
    const z = getValue(config.qzPath);
    const w = getValue(config.qwPath);
    if (x != null && y != null && z != null && w != null) {
      const yawRad = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
      angleDeg = (yawRad * 180) / Math.PI;
    }
  }

  if (angleDeg != null && config.expr.trim()) {
    angleDeg = applyExpr(angleDeg, config.expr);
  }

  const heading = angleDeg != null ? ((angleDeg % 360) + 360) % 360 : undefined;

  const stale = config.staleCheck && paths.every((p) => isStale(p));

  useEffect(() => {
    const nodes: SettingsTreeNodes = {
      general: {
        label: "General",
        fields: {
          inputMode: {
            label: "Input",
            input: "select",
            value: config.inputMode,
            options: [
              { label: "Scalar angle", value: "scalar" },
              { label: "Quaternion (x, y, z, w)", value: "quaternion" },
            ],
          },
          ...(config.inputMode === "scalar"
            ? {
                headingPath: { label: "Heading", input: "messagepath", value: config.headingPath },
                unit: {
                  label: "Unit",
                  input: "select",
                  value: config.unit,
                  options: [
                    { label: "Degrees", value: "deg" },
                    { label: "Radians", value: "rad" },
                  ],
                },
              }
            : {
                qxPath: { label: "x", input: "messagepath", value: config.qxPath },
                qyPath: { label: "y", input: "messagepath", value: config.qyPath },
                qzPath: { label: "z", input: "messagepath", value: config.qzPath },
                qwPath: { label: "w", input: "messagepath", value: config.qwPath },
              }),
          staleCheck: { label: "Staleness Check", input: "boolean", value: config.staleCheck },
        },
      },
      data: {
        label: "Data",
        defaultExpansionState: "collapsed",
        error: exprError(config.expr),
        fields: {
          expr: {
            label: "Expression (x = degrees, empty = off)",
            input: "string",
            value: config.expr,
            placeholder: "e.g. -x, x + 90, -x + 90",
          },
        },
      },
    };

    context.updatePanelSettingsEditor({
      actionHandler: (action: SettingsTreeAction) => {
        if (action.action !== "update") return;
        const { path, value } = action.payload;
        const key = path[path.length - 1] as keyof Config;
        setConfig((prev) => {
          const next = {
            ...prev,
            [key]: boolKeys.has(key) ? Boolean(value) : String(value ?? ""),
          } as Config;
          context.saveState(next);
          return next;
        });
      },
      nodes,
    });
  }, [context, config]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "100%", height: "100%",
        ...(stale ? STALE_STYLE : null),
      }}
    >
      <HeadingIndicator heading={heading} size={size} />
    </div>
  );
}

export function initHeadingIndicatorPanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<HeadingIndicatorPanel context={context} />);
  return () => { root.unmount(); };
}

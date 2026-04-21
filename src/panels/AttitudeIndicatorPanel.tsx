import { PanelExtensionContext, SettingsTreeAction } from "@foxglove/extension";
import { ReactElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AttitudeIndicator } from "../instruments/AttitudeIndicator";

import { STALE_STYLE, useInstrumentPanel } from "../useInstrumentPanel";

type Config = {
  pitchPath: string;
  rollPath: string;
  staleCheck: boolean;
};

const defaultConfig: Config = {
  pitchPath: "",
  rollPath: "",
  staleCheck: true,
};

const boolKeys = new Set<keyof Config>(["staleCheck"]);

function AttitudeIndicatorPanel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [config, setConfig] = useState<Config>(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));

  const paths = [config.pitchPath, config.rollPath];
  const { getValue, isStale, containerRef, size } = useInstrumentPanel(context, paths);
  const pitch = getValue(config.pitchPath);
  const roll = getValue(config.rollPath);

  const stale = config.staleCheck && paths.every((p) => isStale(p));

  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: (action: SettingsTreeAction) => {
        if (action.action === "update") {
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
        }
      },
      nodes: {
        general: {
          label: "General",
          fields: {
            pitchPath: { label: "Pitch (deg)", input: "messagepath", value: config.pitchPath },
            rollPath: { label: "Roll (deg)", input: "messagepath", value: config.rollPath },
            staleCheck: { label: "Staleness Check", input: "boolean", value: config.staleCheck },
          },
        },
      },
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
      <AttitudeIndicator pitch={pitch} roll={roll} size={size} />
    </div>
  );
}

export function initAttitudeIndicatorPanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<AttitudeIndicatorPanel context={context} />);
  return () => { root.unmount(); };
}

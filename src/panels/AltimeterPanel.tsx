import { PanelExtensionContext, SettingsTreeAction } from "@foxglove/extension";
import { ReactElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Altimeter } from "../instruments/Altimeter";

import { STALE_STYLE, useInstrumentPanel } from "../useInstrumentPanel";

type Config = {
  altitudePath: string;
  pressurePath: string;
  staleCheck: boolean;
};

const defaultConfig: Config = {
  altitudePath: "",
  pressurePath: "",
  staleCheck: true,
};

const boolKeys = new Set<keyof Config>(["staleCheck"]);

function AltimeterPanel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [config, setConfig] = useState<Config>(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));

  const paths = [config.altitudePath, config.pressurePath];
  const { getValue, isStale, containerRef, size } = useInstrumentPanel(context, paths);
  const altitude = getValue(config.altitudePath);
  const rawPressure = getValue(config.pressurePath);
  // Component has no internal clamping — clamp to full atmospheric range (hPa)
  const pressure = rawPressure != null ? Math.max(870, Math.min(1084, rawPressure)) : undefined;

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
            altitudePath: { label: "Altitude (ft)", input: "messagepath", value: config.altitudePath },
            pressurePath: { label: "Pressure (hPa)", input: "messagepath", value: config.pressurePath },
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
      <Altimeter altitude={altitude} pressure={pressure} size={size} />
    </div>
  );
}

export function initAltimeterPanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<AltimeterPanel context={context} />);
  return () => { root.unmount(); };
}

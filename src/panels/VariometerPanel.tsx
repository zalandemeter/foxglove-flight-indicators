import { PanelExtensionContext, SettingsTreeAction } from "@foxglove/extension";
import { ReactElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Variometer } from "../instruments/Variometer";

import { STALE_STYLE, useInstrumentPanel } from "../useInstrumentPanel";

type Config = {
  varioPath: string;
  staleCheck: boolean;
};

const defaultConfig: Config = {
  varioPath: "",
  staleCheck: true,
};

const boolKeys = new Set<keyof Config>(["staleCheck"]);

function VariometerPanel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [config, setConfig] = useState<Config>(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));

  const paths = [config.varioPath];
  const { getValue, isStale, containerRef, size } = useInstrumentPanel(context, paths);
  const vario = getValue(config.varioPath);

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
            varioPath: { label: "Vario (ft/min)", input: "messagepath", value: config.varioPath },
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
      <Variometer vario={vario} size={size} />
    </div>
  );
}

export function initVariometerPanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<VariometerPanel context={context} />);
  return () => { root.unmount(); };
}

import { PanelExtensionContext, SettingsTreeAction } from "@foxglove/extension";
import { ReactElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { TurnCoordinator } from "../instruments/TurnCoordinator";

import { STALE_STYLE, useInstrumentPanel } from "../useInstrumentPanel";

type Config = {
  turnPath: string;
  staleCheck: boolean;
};

const defaultConfig: Config = {
  turnPath: "",
  staleCheck: true,
};

const boolKeys = new Set<keyof Config>(["staleCheck"]);

function TurnCoordinatorPanel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [config, setConfig] = useState<Config>(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));

  const paths = [config.turnPath];
  const { getValue, isStale, containerRef, size } = useInstrumentPanel(context, paths);
  const rawTurn = getValue(config.turnPath);
  // Component has no internal clamping — clamp to ±20° (standard rate turn marks)
  const turn = rawTurn != null ? Math.max(-20, Math.min(20, rawTurn)) : undefined;

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
            turnPath: { label: "Turn (deg)", input: "messagepath", value: config.turnPath },
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
      <TurnCoordinator turn={turn} size={size} />
    </div>
  );
}

export function initTurnCoordinatorPanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<TurnCoordinatorPanel context={context} />);
  return () => { root.unmount(); };
}

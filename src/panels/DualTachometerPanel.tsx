import { PanelExtensionContext, SettingsTreeAction } from "@foxglove/extension";
import { ReactElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { DualTachometer } from "../instruments/DualTachometer";
import { useInstrumentPanel } from "../useInstrumentPanel";

type Config = {
  engineRpmPath: string;
  rotorRpmPath: string;
  engineMaxRpm: number;
  rotorMaxRpm: number;
};

const defaultConfig: Config = {
  engineRpmPath: "",
  rotorRpmPath: "",
  engineMaxRpm: 5800, // Rotax 915 IS: 100% RPM
  rotorMaxRpm: 600,   // HC-02 main rotor: 100% RPM
};

function DualTachometerPanel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [config, setConfig] = useState<Config>(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));

  const { getValue, containerRef, size } = useInstrumentPanel(context, [
    config.engineRpmPath,
    config.rotorRpmPath,
  ]);

  const engineRpm = getValue(config.engineRpmPath);
  const rotorRpm = getValue(config.rotorRpmPath);

  // Convert raw RPM to % RPM (0–110+ range)
  const enginePct = engineRpm != null ? (engineRpm / config.engineMaxRpm) * 100 : undefined;
  const rotorPct = rotorRpm != null ? (rotorRpm / config.rotorMaxRpm) * 100 : undefined;

  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: (action: SettingsTreeAction) => {
        if (action.action === "update") {
          const { path, value } = action.payload;
          const key = path[1] as keyof Config;
          setConfig((prev) => {
            const next = {
              ...prev,
              [key]:
                key === "engineMaxRpm" || key === "rotorMaxRpm"
                  ? Number(value)
                  : (value as string),
            };
            context.saveState(next);
            return next;
          });
        }
      },
      nodes: {
        general: {
          label: "General",
          fields: {
            engineRpmPath: {
              label: "Engine RPM topic",
              input: "messagepath",
              value: config.engineRpmPath,
            },
            rotorRpmPath: {
              label: "Rotor RPM topic",
              input: "messagepath",
              value: config.rotorRpmPath,
            },
          },
        },
        scaling: {
          label: "Scaling (RPM = 100%)",
          fields: {
            engineMaxRpm: {
              label: "Engine max RPM",
              input: "number",
              value: config.engineMaxRpm,
              min: 1,
              step: 100,
            },
            rotorMaxRpm: {
              label: "Rotor max RPM",
              input: "number",
              value: config.rotorMaxRpm,
              min: 1,
              step: 10,
            },
          },
        },
      },
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
      <DualTachometer enginePct={enginePct} rotorPct={rotorPct} size={size} />
    </div>
  );
}

export function initDualTachometerPanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<DualTachometerPanel context={context} />);
  return () => {
    root.unmount();
  };
}

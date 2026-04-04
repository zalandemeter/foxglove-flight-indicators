import { ExtensionContext } from "@foxglove/extension";

import { initAirspeedPanel } from "./panels/AirspeedPanel";
import { initAltimeterPanel } from "./panels/AltimeterPanel";
import { initAttitudeIndicatorPanel } from "./panels/AttitudeIndicatorPanel";
import { initDualTachometerPanel } from "./panels/DualTachometerPanel";
import { initHeadingIndicatorPanel } from "./panels/HeadingIndicatorPanel";
import { initTachometerPanel } from "./panels/TachometerPanel";
import { initTurnCoordinatorPanel } from "./panels/TurnCoordinatorPanel";
import { initVariometerPanel } from "./panels/VariometerPanel";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({ name: "Airspeed", initPanel: initAirspeedPanel });
  extensionContext.registerPanel({ name: "Altimeter", initPanel: initAltimeterPanel });
  extensionContext.registerPanel({ name: "AttitudeIndicator", initPanel: initAttitudeIndicatorPanel });
  extensionContext.registerPanel({ name: "DualTachometer", initPanel: initDualTachometerPanel });
  extensionContext.registerPanel({ name: "HeadingIndicator", initPanel: initHeadingIndicatorPanel });
  extensionContext.registerPanel({ name: "Tachometer", initPanel: initTachometerPanel });
  extensionContext.registerPanel({ name: "TurnCoordinator", initPanel: initTurnCoordinatorPanel });
  extensionContext.registerPanel({ name: "Variometer", initPanel: initVariometerPanel });
}

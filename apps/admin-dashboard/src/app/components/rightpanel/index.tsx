import type { ReactNode } from "react";
import type { ViewMode } from "../AppLayout";

import { AlertDetailsPanel } from "./alerts/AlertDetailsPanel";
import { EconomicIndicatorsPanel } from "./economic/EconomicIndicatorsPanel";
import { FlightDetailsPanel } from "./flights/FlightDetailsPanel";
import { IncidentDetailsPanel } from "./conflicts/IncidentDetailsPanel";
import { OSINTReportDetailsPanel } from "./osint/OSINTReportDetailsPanel";
import { SatelliteDetailsPanel } from "./satellites/SatelliteDetailsPanel";
import { StreamInfoPanel } from "./streams/StreamInfoPanel";

interface RightPanelProps {
  mode: ViewMode;
  theme?: "light" | "dark";
}

export function RightPanel({ mode, theme = "dark" }: RightPanelProps): ReactNode {
  if (mode === "alerts") return <AlertDetailsPanel theme={theme} />;
  if (mode === "conflicts") return <IncidentDetailsPanel theme={theme} />;
  if (mode === "economic") return <EconomicIndicatorsPanel theme={theme} />;
  if (mode === "flights") return <FlightDetailsPanel theme={theme} />;
  if (mode === "osint") return <OSINTReportDetailsPanel theme={theme} />;
  if (mode === "satellites") return <SatelliteDetailsPanel theme={theme} />;
  if (mode === "streams") return <StreamInfoPanel theme={theme} />;
  return null;
}

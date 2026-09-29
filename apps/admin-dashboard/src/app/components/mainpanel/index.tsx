import type { ReactNode } from "react";
import type { ViewMode } from "../AppLayout";

import { StatsCards } from "./StatsCards";
import { FlightTracker } from "./flights/FlightTracker";
import { SatelliteTracker } from "./satellites/SatelliteTracker";
import { LiveStreams } from "./streams/LiveStreams";
import { EconomicIndicators } from "./economic/EconomicIndicators";
import { ConflictStream } from "./conflicts/ConflictStream";
import { AlertsPanel } from "./alerts/AlertsPanel";
import { OSINTData } from "./osint/OSINTData";

interface MainPanelProps {
  mode: ViewMode;
  theme?: "light" | "dark";
}

export function MainPanel({ mode, theme = "dark" }: MainPanelProps): ReactNode {
  return (
    <div className="flex flex-col w-full h-full">
      <div className="p-3 border-b border-neutral-800">
        <StatsCards theme={theme} />
      </div>
      <div className="flex-1 overflow-hidden">
        {mode === "flights" && <FlightTracker theme={theme} />}
        {mode === "satellites" && <SatelliteTracker theme={theme} />}
        {mode === "streams" && <LiveStreams theme={theme} />}
        {mode === "economic" && <EconomicIndicators theme={theme} />}
        {mode === "conflicts" && <ConflictStream theme={theme} />}
        {mode === "alerts" && <AlertsPanel theme={theme} />}
        {mode === "osint" && <OSINTData theme={theme} />}
      </div>
    </div>
  );
}

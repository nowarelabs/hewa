import type { ReactNode } from "react";
import type { ViewMode } from "../AppLayout";

import { AIFlightsPanel } from "./flights/AIFlightsPanel";
import { AISatellitesPanel } from "./satellites/AISatellitesPanel";
import { AIStreamsPanel } from "./streams/AIStreamsPanel";
import { AIEconomicPanel } from "./economic/AIEconomicPanel";
import { AIConflictsPanel } from "./conflicts/AIConflictsPanel";
import { AIAlertsPanel } from "./alerts/AIAlertsPanel";
import { AIOSINTPanel } from "./osint/AIOSINTPanel";

interface RightMostPanelProps {
  mode: ViewMode;
}

export function RightMostPanel({ mode }: RightMostPanelProps): ReactNode {
  if (mode === "flights") return <AIFlightsPanel />;
  if (mode === "satellites") return <AISatellitesPanel />;
  if (mode === "streams") return <AIStreamsPanel />;
  if (mode === "economic") return <AIEconomicPanel />;
  if (mode === "conflicts") return <AIConflictsPanel />;
  if (mode === "alerts") return <AIAlertsPanel />;
  if (mode === "osint") return <AIOSINTPanel />;
  return null;
}

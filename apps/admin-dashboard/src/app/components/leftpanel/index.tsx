import type { ReactNode } from "react";
import type { ViewMode } from "../AppLayout";

import { AllFlightsPanel } from "./flights/all/AllFlightsPanel";
import { KenyaAirwaysPanel } from "./flights/kenya/KenyaAirwaysPanel";
import { JambojetPanel } from "./flights/jambo/JambojetPanel";
import { Fly540Panel } from "./flights/fly540/Fly540Panel";
import { SafarilinkPanel } from "./flights/safarilink/SafarilinkPanel";

import { AllSatellitesPanel } from "./satellites/all/AllSatellitesPanel";
import { ReconPanel } from "./satellites/recon/ReconPanel";
import { WeatherPanel } from "./satellites/weather/WeatherPanel";
import { CommPanel } from "./satellites/comm/CommPanel";
import { NavigationNavPanel } from "./satellites/nav/NavigationNavPanel";

import { AllStreamsPanel } from "./streams/all/AllStreamsPanel";
import { KTNPanel } from "./streams/ktn/KTNPanel";
import { CitizenPanel } from "./streams/citizen/CitizenPanel";
import { BBCPanel } from "./streams/bbc/BBCPanel";

import { OverviewPanel } from "./economic/overview/OverviewPanel";
import { CurrencyPanel } from "./economic/currency/CurrencyPanel";
import { GDPPanel } from "./economic/gdp/GDPPanel";
import { TradePanel } from "./economic/trade/TradePanel";
import { MarketsPanel } from "./economic/markets/MarketsPanel";

import { AllConflictsPanel } from "./conflicts/all/AllConflictsPanel";
import { ArmedPanel } from "./conflicts/armed/ArmedPanel";
import { ProtestPanel } from "./conflicts/protest/ProtestPanel";
import { TribalPanel } from "./conflicts/tribal/TribalPanel";
import { ResourceConflictPanel } from "./conflicts/resource/ResourceConflictPanel";

import { AllAlertsPanel } from "./alerts/all/AllAlertsPanel";
import { CriticalAlertsPanel } from "./alerts/critical/CriticalAlertsPanel";
import { HighAlertsPanel } from "./alerts/high/HighAlertsPanel";
import { MediumAlertsPanel } from "./alerts/medium/MediumAlertsPanel";
import { LowAlertsPanel } from "./alerts/low/LowAlertsPanel";

import { AllOSINTPanel } from "./osint/all/AllOSINTPanel";
import { CIAPanel } from "./osint/cia/CIAPanel";
import { MilitaryPanel } from "./osint/military/MilitaryPanel";
import { PoliticalPanel } from "./osint/political/PoliticalPanel";
import { EconomicOSINTPanel } from "./osint/economic/EconomicOSINTPanel";

import { useAllFlights, useAirlineFlights } from "../../hooks";

interface LeftPanelProps {
  mode: ViewMode;
  navId: string;
}

function DefaultPanel() {
  return (
    <div className="p-4">
      <p className="text-sm opacity-60">Select a navigation item</p>
    </div>
  );
}

export function LeftPanel({ mode, navId }: LeftPanelProps): ReactNode {
  const { flights: allFlights } = useAllFlights();
  const { flights: kenyaFlights } = useAirlineFlights("KQ");
  const { flights: jamboFlights } = useAirlineFlights("JMB");
  const { flights: fly540Flights } = useAirlineFlights("FY");
  const { flights: safarilinkFlights } = useAirlineFlights("XK");

  if (mode === "flights") {
    if (navId === "all") return <AllFlightsPanel flights={allFlights} />;
    if (navId === "kenya") return <KenyaAirwaysPanel flights={kenyaFlights} />;
    if (navId === "jambo") return <JambojetPanel flights={jamboFlights} />;
    if (navId === "fly540") return <Fly540Panel flights={fly540Flights} />;
    if (navId === "safarilink") return <SafarilinkPanel flights={safarilinkFlights} />;
  }

  if (mode === "satellites") {
    if (navId === "all") return <AllSatellitesPanel />;
    if (navId === "recon") return <ReconPanel />;
    if (navId === "weather") return <WeatherPanel />;
    if (navId === "comm") return <CommPanel />;
    if (navId === "nav") return <NavigationNavPanel />;
  }

  if (mode === "streams") {
    if (navId === "all") return <AllStreamsPanel />;
    if (navId === "ktn") return <KTNPanel />;
    if (navId === "citizen") return <CitizenPanel />;
    if (navId === "bbc") return <BBCPanel />;
  }

  if (mode === "economic") {
    if (navId === "overview") return <OverviewPanel />;
    if (navId === "currency") return <CurrencyPanel />;
    if (navId === "gdp") return <GDPPanel />;
    if (navId === "trade") return <TradePanel />;
    if (navId === "markets") return <MarketsPanel />;
  }

  if (mode === "conflicts") {
    if (navId === "all") return <AllConflictsPanel />;
    if (navId === "armed") return <ArmedPanel />;
    if (navId === "protest") return <ProtestPanel />;
    if (navId === "tribal") return <TribalPanel />;
    if (navId === "resource") return <ResourceConflictPanel />;
  }

  if (mode === "alerts") {
    if (navId === "all") return <AllAlertsPanel />;
    if (navId === "critical") return <CriticalAlertsPanel />;
    if (navId === "high") return <HighAlertsPanel />;
    if (navId === "medium") return <MediumAlertsPanel />;
    if (navId === "low") return <LowAlertsPanel />;
  }

  if (mode === "osint") {
    if (navId === "all") return <AllOSINTPanel />;
    if (navId === "cia") return <CIAPanel />;
    if (navId === "military") return <MilitaryPanel />;
    if (navId === "political") return <PoliticalPanel />;
    if (navId === "economic") return <EconomicOSINTPanel />;
  }

  return <DefaultPanel />;
}

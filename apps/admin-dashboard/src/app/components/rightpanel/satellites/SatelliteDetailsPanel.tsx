interface SatelliteDetailsPanelProps {
  theme?: "light" | "dark";
}

export function SatelliteDetailsPanel({ theme: _theme = "dark" }: SatelliteDetailsPanelProps) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">Satellite Details</h3>
      <div className="space-y-2">
        <div className="text-sm opacity-60">Select a satellite to view details</div>
      </div>
    </div>
  );
}

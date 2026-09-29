interface FlightDetailsPanelProps {
  theme?: "light" | "dark";
}

export function FlightDetailsPanel({ theme: _theme = "dark" }: FlightDetailsPanelProps) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">Flight Details</h3>
      <div className="space-y-2">
        <div className="text-sm opacity-60">Select a flight to view details</div>
      </div>
    </div>
  );
}

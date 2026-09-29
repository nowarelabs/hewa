interface IncidentDetailsPanelProps {
  theme?: "light" | "dark";
}

export function IncidentDetailsPanel({ theme: _theme = "dark" }: IncidentDetailsPanelProps) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">Incident Details</h3>
      <div className="space-y-2">
        <div className="text-sm opacity-60">Select an incident to view details</div>
      </div>
    </div>
  );
}

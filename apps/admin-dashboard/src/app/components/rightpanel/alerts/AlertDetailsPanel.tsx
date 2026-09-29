interface AlertDetailsPanelProps {
  theme?: "light" | "dark";
}

export function AlertDetailsPanel({ theme: _theme = "dark" }: AlertDetailsPanelProps) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">Alert Details</h3>
      <div className="space-y-2">
        <div className="text-sm opacity-60">Select an alert to view details</div>
      </div>
    </div>
  );
}

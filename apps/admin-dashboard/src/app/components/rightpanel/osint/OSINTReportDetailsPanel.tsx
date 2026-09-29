interface OSINTReportDetailsPanelProps {
  theme?: "light" | "dark";
}

export function OSINTReportDetailsPanel({ theme: _theme = "dark" }: OSINTReportDetailsPanelProps) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">Report Details</h3>
      <div className="space-y-2">
        <div className="text-sm opacity-60">Select a report to view details</div>
      </div>
    </div>
  );
}

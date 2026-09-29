interface EconomicIndicatorsPanelProps {
  theme?: "light" | "dark";
}

export function EconomicIndicatorsPanel({ theme: _theme = "dark" }: EconomicIndicatorsPanelProps) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">Indicators</h3>
      <div className="space-y-2">
        <div className="text-sm opacity-60">Select an indicator</div>
      </div>
    </div>
  );
}

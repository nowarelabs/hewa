export function OverviewPanel() {
  const indicators = [
    { label: "GDP Growth", value: "5.2%" },
    { label: "Inflation", value: "4.3%" },
    { label: "Unemployment", value: "5.5%" },
  ];

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">Overview</h3>
      <div className="space-y-2">
        {indicators.map((ind) => (
          <div key={ind.label} className="flex justify-between">
            <span className="text-sm opacity-60">{ind.label}</span>
            <span className="text-sm font-medium">{ind.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

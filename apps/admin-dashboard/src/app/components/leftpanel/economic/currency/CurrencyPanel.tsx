export function CurrencyPanel() {
  const rates = [
    { pair: "KES/USD", rate: "153.45" },
    { pair: "KES/EUR", rate: "168.20" },
    { pair: "KES/GBP", rate: "195.30" },
  ];

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">Currency</h3>
      <div className="space-y-2">
        {rates.map((r) => (
          <div key={r.pair} className="flex justify-between">
            <span className="text-sm opacity-60">{r.pair}</span>
            <span className="text-sm font-medium">{r.rate}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

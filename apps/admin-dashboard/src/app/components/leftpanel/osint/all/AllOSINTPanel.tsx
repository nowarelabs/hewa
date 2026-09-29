export function AllOSINTPanel() {
  const reports = [
    { source: "CIA", title: "Regional Assessment", date: "2024-01-15" },
    { source: "Military", title: "Force Deployment", date: "2024-01-14" },
    { source: "Political", title: "Election Update", date: "2024-01-13" },
  ];

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">All Reports</h3>
      <div className="space-y-2">
        {reports.map((r, i) => (
          <div key={i} className="p-2 border rounded">
            <div className="text-sm font-medium">{r.title}</div>
            <div className="text-xs opacity-60">
              {r.source} - {r.date}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

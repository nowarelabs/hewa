export function AllConflictsPanel() {
  const incidents = [
    { type: "Tribal", location: "Marsabit", date: "2024-01-15" },
    { type: "Protest", location: "Kisumu", date: "2024-01-14" },
    { type: "Resource", location: "Nakuru", date: "2024-01-13" },
  ];

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">All Incidents</h3>
      <div className="space-y-2">
        {incidents.map((inc, i) => (
          <div key={i} className="p-2 border rounded">
            <div className="text-sm font-medium">{inc.type}</div>
            <div className="text-xs opacity-60">
              {inc.location} - {inc.date}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

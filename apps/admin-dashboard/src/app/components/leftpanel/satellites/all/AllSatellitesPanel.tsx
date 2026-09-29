export function AllSatellitesPanel() {
  const satellites = [
    { name: "Landsat 8", type: "Earth Observation" },
    { name: "Sentinel-2A", type: "Earth Observation" },
    { name: "ISS", type: "Space Station" },
  ];

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">All Satellites</h3>
      <div className="space-y-2">
        {satellites.map((sat) => (
          <div key={sat.name} className="p-2 border rounded">
            <div className="text-sm font-medium">{sat.name}</div>
            <div className="text-xs opacity-60">{sat.type}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

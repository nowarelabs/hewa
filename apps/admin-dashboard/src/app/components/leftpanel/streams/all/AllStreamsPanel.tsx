export function AllStreamsPanel() {
  const streams = [
    { name: "KTN News", status: "Live" },
    { name: "Citizen TV", status: "Live" },
    { name: "BBC Africa", status: "Offline" },
    { name: "CNN", status: "Offline" },
  ];

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">All Streams</h3>
      <div className="space-y-2">
        {streams.map((stream) => (
          <div key={stream.name} className="p-2 border rounded">
            <div className="text-sm font-medium">{stream.name}</div>
            <div className="text-xs opacity-60">{stream.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

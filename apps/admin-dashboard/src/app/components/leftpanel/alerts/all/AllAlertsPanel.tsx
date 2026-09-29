export function AllAlertsPanel() {
  const alerts = [
    { severity: "Critical", title: "Security Alert in Mandera", time: "10:30" },
    { severity: "High", title: "Weather Warning in Western", time: "09:15" },
    {
      severity: "Medium",
      title: "Traffic Advisory in Machakos",
      time: "08:00",
    },
  ];

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">All Alerts</h3>
      <div className="space-y-2">
        {alerts.map((alert, i) => (
          <div key={i} className="p-2 border rounded">
            <div className="text-sm font-medium">{alert.title}</div>
            <div className="text-xs opacity-60">
              {alert.severity} - {alert.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

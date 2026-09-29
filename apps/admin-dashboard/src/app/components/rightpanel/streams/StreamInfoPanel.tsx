interface StreamInfoPanelProps {
  theme?: "light" | "dark";
}

export function StreamInfoPanel({ theme: _theme = "dark" }: StreamInfoPanelProps) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">Stream Info</h3>
      <div className="space-y-2">
        <div className="text-sm opacity-60">Select a stream to view info</div>
      </div>
    </div>
  );
}

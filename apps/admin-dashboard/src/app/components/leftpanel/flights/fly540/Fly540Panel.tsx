interface FlightData {
  icao24: string;
  callsign: string;
  originCountry: string;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  heading: number;
  isArriving: boolean;
  isDeparting: boolean;
}

interface Fly540PanelProps {
  flights?: FlightData[];
}

export function Fly540Panel({ flights = [] }: Fly540PanelProps) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">Fly540</h3>
      {flights.length === 0 && <div className="text-xs opacity-60">No flights detected</div>}
      <div className="space-y-2">
        {flights.slice(0, 10).map((flight) => (
          <div key={flight.icao24} className="p-2 border rounded">
            <div className="text-sm font-medium">{flight.callsign}</div>
            <div className="text-xs opacity-60">
              {flight.originCountry} - Alt: {Math.round(flight.altitude)}m
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

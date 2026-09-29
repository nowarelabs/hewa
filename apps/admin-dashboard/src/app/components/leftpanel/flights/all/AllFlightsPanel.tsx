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

interface AllFlightsPanelProps {
  flights?: FlightData[];
}

export function AllFlightsPanel({ flights = [] }: AllFlightsPanelProps) {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium mb-3">All Flights</h3>
      {flights.length === 0 && <div className="text-xs opacity-60">No flights detected</div>}
      <div className="space-y-2">
        {flights.slice(0, 20).map((flight) => (
          <div key={flight.icao24} className="p-2 border rounded">
            <div className="text-sm font-medium">{flight.callsign}</div>
            <div className="text-xs opacity-60">
              {flight.originCountry} - Alt: {Math.round(flight.altitude)}m
              {flight.isArriving && " - Arriving"}
              {flight.isDeparting && " - Departing"}
            </div>
          </div>
        ))}
      </div>
      {flights.length > 20 && (
        <div className="text-xs opacity-60 mt-2">+{flights.length - 20} more flights</div>
      )}
    </div>
  );
}

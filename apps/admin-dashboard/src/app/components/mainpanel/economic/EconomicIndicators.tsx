import { BarChart, TrendingUp, TrendingDown, DollarSign, Percent, Activity } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface EconomicData {
  currency: {
    code: string;
    rate: number;
    change: number;
  };
  inflation: number;
  gdp: number;
  gdpGrowth: number;
  unemployment: number;
  tradeBalance: number;
}

interface EconomicIndicatorsProps {
  theme?: "light" | "dark";
}

const economicData: EconomicData = {
  currency: {
    code: "KES",
    rate: 153.25,
    change: 0.15,
  },
  inflation: 6.8,
  gdp: 115.3,
  gdpGrowth: 5.1,
  unemployment: 12.8,
  tradeBalance: -2.4,
};

const gdpData = [
  { month: "Jan", value: 9.2 },
  { month: "Feb", value: 9.5 },
  { month: "Mar", value: 9.8 },
  { month: "Apr", value: 10.1 },
  { month: "May", value: 10.4 },
  { month: "Jun", value: 10.2 },
  { month: "Jul", value: 10.5 },
  { month: "Aug", value: 10.8 },
  { month: "Sep", value: 11.0 },
  { month: "Oct", value: 11.2 },
  { month: "Nov", value: 11.5 },
  { month: "Dec", value: 11.8 },
];

const sectorData = [
  { name: "Agriculture", value: 35 },
  { name: "Services", value: 45 },
  { name: "Industry", value: 20 },
];

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b"];

export function EconomicIndicators({ theme = "dark" }: EconomicIndicatorsProps) {
  const isDark = theme === "dark";
  return (
    <div className={`h-full overflow-auto ${isDark ? "bg-neutral-900" : "bg-white"}`}>
      <div
        className={`p-4 border-b ${isDark ? "border-neutral-800" : "border-gray-200"} flex items-center gap-2`}
      >
        <BarChart className="w-5 h-5 text-cyan-400" />
        <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
          Economic Indicators
        </h2>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div
            className={`p-3 rounded-lg border ${isDark ? "bg-neutral-800 border-neutral-700" : "bg-gray-50 border-gray-200"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs ${isDark ? "text-neutral-400" : "text-gray-500"}`}>
                KES/USD
              </span>
              <DollarSign className="w-4 h-4 text-green-400" />
            </div>
            <div className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              {economicData.currency.rate.toFixed(2)}
            </div>
            <div className="flex items-center gap-1 text-xs text-green-400 mt-1">
              {economicData.currency.change > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>+{economicData.currency.change}%</span>
            </div>
          </div>

          <div
            className={`p-3 rounded-lg border ${isDark ? "bg-neutral-800 border-neutral-700" : "bg-gray-50 border-gray-200"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs ${isDark ? "text-neutral-400" : "text-gray-500"}`}>
                Inflation
              </span>
              <Percent className="w-4 h-4 text-red-400" />
            </div>
            <div className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              {economicData.inflation}%
            </div>
            <div className="text-xs text-red-400 mt-1">Year over Year</div>
          </div>

          <div
            className={`p-3 rounded-lg border ${isDark ? "bg-neutral-800 border-neutral-700" : "bg-gray-50 border-gray-200"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs ${isDark ? "text-neutral-400" : "text-gray-500"}`}>
                GDP Growth
              </span>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              {economicData.gdpGrowth}%
            </div>
            <div className="text-xs text-green-400 mt-1">Q4 2025</div>
          </div>

          <div
            className={`p-3 rounded-lg border ${isDark ? "bg-neutral-800 border-neutral-700" : "bg-gray-50 border-gray-200"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs ${isDark ? "text-neutral-400" : "text-gray-500"}`}>
                Unemployment
              </span>
              <Percent className="w-4 h-4 text-orange-400" />
            </div>
            <div className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              {economicData.unemployment}%
            </div>
            <div className={`text-xs ${isDark ? "text-neutral-400" : "text-gray-500"} mt-1`}>
              National Rate
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div
            className={`p-4 rounded-lg border ${isDark ? "bg-neutral-800 border-neutral-700" : "bg-gray-50 border-gray-200"}`}
          >
            <h3 className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"} mb-4`}>
              GDP Growth (Billions USD)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gdpData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div
            className={`p-4 rounded-lg border ${isDark ? "bg-neutral-800 border-neutral-700" : "bg-gray-50 border-gray-200"}`}
          >
            <h3 className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"} mb-4`}>
              GDP by Sector
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sectorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                  >
                    {sectorData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

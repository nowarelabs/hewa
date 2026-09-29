import { FileText, Clock, Shield, Globe, TrendingUp, Users } from "lucide-react";

interface OSINTItem {
  id: string;
  title: string;
  description: string;
  category: "cia" | "military" | "economic" | "political" | "social";
  source: string;
  timestamp: string;
  confidence: number;
}

interface OSINTDataProps {
  theme?: "light" | "dark";
}

const osintData: OSINTItem[] = [
  {
    id: "1",
    title: "Regional Military Deployment Update",
    description:
      "Increased military presence observed in Northern Kenya. Intelligence suggests routine rotation and infrastructure strengthening.",
    category: "military",
    source: "Satellite Imagery Analysis",
    timestamp: "2026-03-26T08:00:00Z",
    confidence: 85,
  },
  {
    id: "2",
    title: "Trade Corridor Activity",
    description:
      "Mombasa port throughput increased 15% month-over-month. Chinese investment in infrastructure continues to drive growth.",
    category: "economic",
    source: "Trade Data Analysis",
    timestamp: "2026-03-26T07:30:00Z",
    confidence: 92,
  },
  {
    id: "3",
    title: "Political Coalition Formation",
    description:
      "Opposition parties showing signs of coalition building ahead of 2027 elections. Key alliances forming in Central Kenya.",
    category: "political",
    source: "Human Intelligence",
    timestamp: "2026-03-26T06:00:00Z",
    confidence: 78,
  },
  {
    id: "4",
    title: "Social Media Sentiment Analysis",
    description:
      "Public sentiment trending negative regarding economic conditions. Inflation concerns dominate discussions.",
    category: "social",
    source: "Social Media Monitoring",
    timestamp: "2026-03-25T22:00:00Z",
    confidence: 88,
  },
  {
    id: "5",
    title: "Cross-Border Movement Patterns",
    description:
      "Increased refugee movement from Somalia into Dadaab region. Border monitoring stations reporting higher traffic.",
    category: "cia",
    source: "Border Surveillance",
    timestamp: "2026-03-25T18:00:00Z",
    confidence: 90,
  },
  {
    id: "6",
    title: "Infrastructure Development",
    description:
      "New highway construction between Nairobi and Nakuru progressing ahead of schedule. Economic impact significant.",
    category: "economic",
    source: "Satellite Imagery Analysis",
    timestamp: "2026-03-25T14:00:00Z",
    confidence: 95,
  },
  {
    id: "7",
    title: "Tribal Alliance Networks",
    description:
      "Analysis of political alliance patterns shows strong regional tribal affiliations affecting coalition mathematics.",
    category: "political",
    source: "Network Analysis",
    timestamp: "2026-03-25T10:00:00Z",
    confidence: 72,
  },
  {
    id: "8",
    title: "Youth Unemployment Sentiment",
    description:
      "Youth demographics expressing frustration via social platforms. Potential unrest vector identified.",
    category: "social",
    source: "Social Media Monitoring",
    timestamp: "2026-03-25T08:00:00Z",
    confidence: 82,
  },
];

export function OSINTData({ theme = "dark" }: OSINTDataProps) {
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, typeof Shield> = {
      cia: Shield,
      military: Globe,
      economic: TrendingUp,
      political: Users,
      social: FileText,
    };
    return icons[category] || FileText;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      cia: "text-red-400 bg-red-500/20",
      military: "text-green-400 bg-green-500/20",
      economic: "text-yellow-400 bg-yellow-500/20",
      political: "text-blue-400 bg-blue-500/20",
      social: "text-purple-400 bg-purple-500/20",
    };
    return colors[category] || "text-neutral-400 bg-neutral-500/20";
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-400";
    if (confidence >= 75) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className={`h-full flex flex-col ${theme === "dark" ? "bg-neutral-900" : "bg-white"}`}>
      <div className="p-4 border-b border-neutral-800 flex items-center gap-2">
        <FileText className="w-5 h-5 text-cyan-400" />
        <h2
          className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
        >
          OSINT Data
        </h2>
        <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
          {osintData.length} reports
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {osintData.map((item) => {
            const CategoryIcon = getCategoryIcon(item.category);
            return (
              <div
                key={item.id}
                className={`p-4 rounded-lg border ${
                  theme === "dark"
                    ? "bg-neutral-800 border-neutral-700"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CategoryIcon
                      className={`w-4 h-4 ${getCategoryColor(item.category).split(" ")[0]}`}
                    />
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${getCategoryColor(item.category)}`}
                    >
                      {item.category.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-neutral-400">Confidence:</span>
                    <span className={`font-medium ${getConfidenceColor(item.confidence)}`}>
                      {item.confidence}%
                    </span>
                  </div>
                </div>

                <h3
                  className={`font-medium mb-1 ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  {item.title}
                </h3>
                <p className={`text-sm text-neutral-400 mb-2`}>{item.description}</p>

                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    {item.source}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

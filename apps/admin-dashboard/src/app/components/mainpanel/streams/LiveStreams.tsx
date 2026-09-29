import { useState } from "react";
import { Radio, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

interface LiveStream {
  id: string;
  title: string;
  channel: string;
  youtubeId: string;
  thumbnail?: string;
}

interface LiveStreamsProps {
  theme?: "light" | "dark";
}

const streams: LiveStream[] = [
  {
    id: "1",
    title: "Citizen TV Kenya",
    channel: "Citizen TV",
    youtubeId: "XaAGe0YGOgI",
  },
  {
    id: "2",
    title: "KTN News Live",
    channel: "KTN News",
    youtubeId: "dl_-tX3lCto",
  },
  {
    id: "3",
    title: "Al Jazeera Live",
    channel: "Al Jazeera",
    youtubeId: "gCNeDWCI0vo",
  },
  {
    id: "4",
    title: "Sky News Live",
    channel: "Sky News",
    youtubeId: "YDvsBbKfLPA",
  },
  {
    id: "5",
    title: "NTV Kenya Live",
    channel: "NTV Kenya",
    youtubeId: "ZRDj5GXNezw",
  },
  {
    id: "6",
    title: "K24 LIVE",
    channel: "K24",
    youtubeId: "d0BlPe6TyEg",
  },
  {
    id: "7",
    title: "Spice FM",
    channel: "Spice FM",
    youtubeId: "GtVUMcMpv9M",
  },
  {
    id: "8",
    title: "BBC World Service",
    channel: "BBC World",
    youtubeId: "_q3VkWny8J0",
  },
];

export function LiveStreams({ theme = "dark" }: LiveStreamsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const isDark = theme === "dark";
  const activeStream = streams[activeIndex];

  const goToPrevious = () => {
    setActiveIndex((prev) => (prev === 0 ? streams.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setActiveIndex((prev) => (prev === streams.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className={`h-full flex flex-col ${isDark ? "bg-neutral-900" : "bg-white"}`}>
      <div
        className={`p-4 border-b ${isDark ? "border-neutral-800" : "border-gray-200"} flex items-center gap-2`}
      >
        <Radio className="w-5 h-5 text-green-400" />
        <h2 className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
          Live Streams
        </h2>
        <span
          className={`text-xs px-2 py-0.5 rounded ${isDark ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700"}`}
        >
          {streams.length} channels
        </span>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 p-4">
          <div
            className={`w-full h-full rounded-lg overflow-hidden border ${isDark ? "border-neutral-700 bg-neutral-800" : "border-gray-200 bg-gray-100"}`}
          >
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${activeStream.youtubeId}?autoplay=1`}
              title={activeStream.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        <div className={`p-4 border-t ${isDark ? "border-neutral-800" : "border-gray-200"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                {activeStream.channel}
              </span>
              <span className={`text-xs ${isDark ? "text-neutral-400" : "text-gray-500"}`}>
                ({activeIndex + 1}/{streams.length})
              </span>
            </div>
            <a
              href={`https://youtube.com/watch?v=${activeStream.youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1 text-xs ${isDark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
            >
              <ExternalLink className="w-3 h-3" />
              YouTube
            </a>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              onClick={goToPrevious}
              className={`p-2 rounded-md ${isDark ? "bg-neutral-800 text-neutral-400 hover:bg-neutral-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {streams.map((stream, idx) => (
              <button
                key={stream.id}
                onClick={() => setActiveIndex(idx)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  idx === activeIndex
                    ? isDark
                      ? "bg-green-600 text-white"
                      : "bg-green-600 text-white"
                    : isDark
                      ? "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {stream.channel}
              </button>
            ))}

            <button
              onClick={goToNext}
              className={`p-2 rounded-md ${isDark ? "bg-neutral-800 text-neutral-400 hover:bg-neutral-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import type { ReactElement } from "react";
import { ExternalLink, Radio } from "lucide-react";

import type { PanelProps } from "@hewa/app-shell";
import { CardList, Empty, KeyValues, Panel } from "./primitives";
import { createStore, useStore } from "./store";

interface Stream {
  id: string;
  title: string;
  channel: string;
  videoId: string;
}

const STREAMS: Stream[] = [
  {
    id: "1",
    title: "Citizen TV Kenya",
    channel: "citizen",
    videoId: "XaAGe0YGOgI",
  },
  { id: "2", title: "KTN News Live", channel: "ktn", videoId: "dl_-tX3lCto" },
  {
    id: "3",
    title: "Al Jazeera Live",
    channel: "aljazeera",
    videoId: "gCNeDWCI0vo",
  },
  {
    id: "4",
    title: "Sky News Live",
    channel: "skynews",
    videoId: "YDvsBbKfLPA",
  },
  { id: "5", title: "NTV Kenya Live", channel: "ntv", videoId: "ZRDjGXNezw" },
  { id: "6", title: "K24 LIVE", channel: "k24", videoId: "d0BlPe6TyEg" },
  { id: "7", title: "Spice FM", channel: "spice", videoId: "GtVUMmPmv9s" },
  { id: "8", title: "Capital FM", channel: "capital", videoId: "9dTw7h1LdlE" },
];

/**
 * Which channel is on screen, shared between the player and the info column.
 *
 * The selection used to be `useState` inside the player, and the info column
 * reported `STREAMS[0]` as "Playing" no matter what the viewer had clicked. It
 * was wrong in the one way a status line should never be wrong.
 */
const SELECTED = createStore<string>(STREAMS[0]?.id ?? "");

function useSelected(): Stream | undefined {
  const id = useStore(SELECTED);
  return STREAMS.find((stream) => stream.id === id);
}

/**
 * The rail is derived from the channels that exist. It used to offer "BBC
 * Africa" and the list had no such channel, so that entry was an empty list
 * that looked like an outage.
 */
const RAIL: { id: string; label: string }[] = [
  { id: "all", label: "All streams" },
  { id: "ktn", label: "KTN News" },
  { id: "citizen", label: "Citizen TV" },
  { id: "ntv", label: "NTV Kenya" },
  { id: "k24", label: "K24" },
];

export function StreamListPanel({ item }: PanelProps): ReactElement {
  const selected = useSelected();
  const entry = RAIL.find((candidate) => candidate.id === item) ?? RAIL[0];
  const channel = entry?.id === "all" || entry === undefined;
  const shown = channel ? STREAMS : STREAMS.filter((stream) => stream.channel === entry?.id);

  return (
    <Panel title={entry?.label ?? "Streams"}>
      {shown.length === 0 ? (
        <Empty>No channels in this group</Empty>
      ) : (
        <CardList
          items={shown.map((stream) => ({
            id: stream.id,
            title: stream.title,
            detail: stream.id === selected?.id ? "On screen" : stream.channel,
          }))}
        />
      )}
    </Panel>
  );
}

export function LiveStreams(): ReactElement {
  const current = useSelected();

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-line p-4">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-green-400" />
          <h1 className="text-lg font-semibold text-ink">Live streams</h1>
          <span className="rounded bg-green-500/15 px-2 py-0.5 text-xs text-green-400">
            {STREAMS.length} channels
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-4 lg:grid-cols-3">
        {current === undefined ? (
          <p className="text-xs text-ink-faint lg:col-span-2">
            <Empty>No channel selected</Empty>
          </p>
        ) : (
          <div className="lg:col-span-2">
            <iframe
              title={current.title}
              src={`https://www.youtube-nocookie.com/embed/${current.videoId}`}
              className="aspect-video w-full rounded border border-line"
              allowFullScreen
            />
          </div>
        )}
        <div className="space-y-2">
          {STREAMS.map((stream) => (
            <button
              key={stream.id}
              type="button"
              onClick={() => SELECTED.set(stream.id)}
              aria-pressed={stream.id === current?.id}
              className={`flex w-full items-center gap-2 rounded border p-2 text-left text-sm transition-colors ${
                stream.id === current?.id
                  ? "border-accent bg-accent/10 text-ink"
                  : "border-line bg-surface-raised text-ink-muted hover:bg-surface-sunken"
              }`}
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              {stream.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StreamInfoPanel(): ReactElement {
  const current = useSelected();
  return (
    <Panel title="Stream info">
      <KeyValues
        rows={[
          { label: "Channels", value: STREAMS.length },
          { label: "Playing", value: current?.title ?? "None" },
        ]}
      />
    </Panel>
  );
}

"use client";

import type { ReactElement } from "react";
import { ExternalLink, Radio } from "lucide-react";

import type { PanelProps } from "@hewa/app-shell";
import { CardList, Empty, KeyValues, Panel, SummaryBar, emptyMessage } from "../ui/primitives";
import { useStreams, type Stream } from "../data/streams";
import { createStore, useStore } from "../state/store";

/**
 * The `streams` view: every panel the Streams tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks what the view is about, the middle
 * column lists it, and the right column describes the selection.
 */

/**
 * Which channel is on screen, shared between the player and the info column.
 *
 * The selection used to be `useState` inside the player, and the info column
 * reported the first channel in the local list as "Playing" no matter what the
 * viewer had clicked. It was wrong in the one way a status line should never be
 * wrong.
 *
 * The store holds an id and not a channel, and starts empty rather than starting
 * on the first row. That matters now the rows arrive: a store initialised from
 * the list would capture whatever the list was when the module was first
 * evaluated, which is nothing, and the store would then name a channel that is
 * not there. Resolving the id against the rows on each render keeps the
 * selection meaning the same thing whether the rows came from a constant or from
 * a service.
 */
const SELECTED = createStore<string>("");

function useSelected(rows: readonly Stream[]): Stream | undefined {
  const id = useStore(SELECTED);
  return rows.find((stream) => stream.id === id) ?? rows[0];
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
  const { rows, status } = useStreams();
  const selected = useSelected(rows);
  const entry = RAIL.find((candidate) => candidate.id === item) ?? RAIL[0];
  const channel = entry?.id === "all" || entry === undefined;
  const shown = channel ? rows : rows.filter((stream) => stream.channel === entry?.id);

  return (
    <Panel title={entry?.label ?? "Streams"}>
      {shown.length === 0 ? (
        <Empty>
          {emptyMessage({
            status,
            filtered: !channel,
            noun: "channels",
            filter: "this group",
          })}
        </Empty>
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
  const { rows, status } = useStreams();
  const current = useSelected(rows);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-line p-4">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-green-400" />
          <h1 className="text-lg font-semibold text-ink">Live streams</h1>
          <span className="rounded bg-green-500/15 px-2 py-0.5 text-xs text-green-400">
            {rows.length} channels
          </span>
        </div>
      </header>

      {/* No `filter` here, and deliberately. This bar is not a breakdown of the
          list beneath it: "On screen" is the selection and "Rail entries" is a
          count of the rail, and a toggle over either would either do nothing or
          filter the list by something the list is not grouped by. The two views
          that would be lying — this one and the economy view — are the two that
          pass no filter, so the bar is honest wherever it cannot act. */}
      <SummaryBar
        items={[
          { label: "On screen", value: current?.title ?? "None" },
          {
            label: "Rail entries",
            value: RAIL.length,
            tint: "border-green-500/30 bg-green-500/15 text-green-400",
          },
        ]}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-4 lg:grid-cols-3">
        {current === undefined ? (
          <p className="text-xs text-ink-faint lg:col-span-2">
            <Empty>{emptyMessage({ status, filtered: false, noun: "channels" })}</Empty>
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
          {rows.map((stream) => (
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
  const { rows } = useStreams();
  const current = useSelected(rows);
  return (
    <Panel title="Stream info">
      <KeyValues
        rows={[
          { label: "Channels", value: rows.length },
          { label: "Playing", value: current?.title ?? "None" },
        ]}
      />
    </Panel>
  );
}

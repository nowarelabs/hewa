"use client";

import type { ReactElement } from "react";
import { Radio } from "lucide-react";

import type { PanelProps } from "@hewa/app-shell";
import {
  CardList,
  Empty,
  KeyValues,
  Panel,
  SummaryBar,
  emptyMessage,
  summaryCounts,
  visibleBy,
} from "../ui/primitives";
import { useFilterParam } from "../state/filter";
import { useStreams, type StreamChannel } from "../data/streams";

/**
 * The `streams` view: every panel the Streams tab can show.
 *
 * One view, one module, named for the key it is registered under in
 * `shell.config.tsx`. The rail picks what the view is about, the middle
 * column lists it, and the right column describes the selection.
 */

/**
 * The channels, named once.
 *
 * The rail and the bar both label a channel, and they used to carry two lists of
 * names that had to agree: five channel entries in `shell.config.tsx` and five
 * more here, neither derived from the service. A channel the service stopped
 * holding stayed in the rail as a tab that opened an empty column, and a channel
 * it had started holding was unreachable from the rail at all. One table, keyed
 * by the vocabulary the service sends, and a label cannot drift from a channel
 * because the type will not let it.
 */
const CHANNEL_LABEL: Record<StreamChannel, string> = {
  citizen: "Citizen TV",
  ktn: "KTN News",
  aljazeera: "Al Jazeera",
  skynews: "Sky News",
  ntv: "NTV Kenya",
  k24: "K24",
  spice: "Spice FM",
  capital: "Capital FM",
};

/**
 * What the rail offers, exported because `shell.config.tsx` builds the tabs from
 * it rather than repeating the list.
 *
 * `channel` is `null` for the one entry that means every channel. The rail
 * covers the whole vocabulary rather than a chosen few, and is derived from
 * {@link CHANNEL_LABEL} rather than written out, so it cannot miss a channel
 * that table has an entry for.
 */
export const STREAM_RAIL: { id: string; label: string; channel: StreamChannel | null }[] = [
  { id: "all", label: "All streams", channel: null },
  ...(Object.keys(CHANNEL_LABEL) as StreamChannel[]).map((channel) => ({
    id: channel,
    label: CHANNEL_LABEL[channel],
    channel,
  })),
];

/**
 * The left column: every channel, or the one the rail picked.
 *
 * The panel resolves `item` against the service's vocabulary rather than
 * against this table, so a rail entry the service does not offer falls back to
 * the whole catalogue instead of opening a column with nothing in it.
 */
export function StreamRailPanel({ item }: PanelProps): ReactElement {
  const { rows, groups, status } = useStreams();
  const channel = groups.find((entry) => entry === item) ?? null;
  const shown = channel === null ? rows : rows.filter((stream) => stream.channel === channel);
  const label = channel === null ? "All streams" : CHANNEL_LABEL[channel];

  return (
    <Panel title={label}>
      {shown.length === 0 ? (
        <Empty>
          {emptyMessage({
            status,
            filtered: channel !== null,
            noun: "streams",
            filter: "this channel",
          })}
        </Empty>
      ) : (
        <CardList
          items={shown.map((stream) => ({
            id: stream.id,
            title: stream.title,
            detail: CHANNEL_LABEL[stream.channel],
          }))}
        />
      )}
    </Panel>
  );
}

/**
 * The main column: every channel, filtered by the bar.
 *
 * This view used to embed a YouTube player and pick the stream it played from a
 * store shared with the info column, so a third party's iframe was the largest
 * thing on screen and a second, hand-built channel list sat beside it doing the
 * job the rail beside this one already does. What is left is the shape the other
 * six views have: a bar that counts the channels and filters on them, and the
 * list it counts.
 */
export function StreamFeed(): ReactElement {
  const { rows, groups, status } = useStreams();
  const channels = useFilterParam("streams");
  const shown = visibleBy(rows, (stream) => stream.channel, channels.selected);

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line p-4">
        <Radio className="h-5 w-5 text-accent" aria-hidden="true" />
        <h1 className="text-lg font-semibold text-ink">Live streams</h1>
        <span className="rounded bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {rows.length} channels
        </span>
      </header>

      <SummaryBar
        items={summaryCounts(rows, (stream) => stream.channel, {
          keys: groups,
          label: (channel) => CHANNEL_LABEL[channel],
          tint: () => "border-accent/30 bg-accent/15 text-accent",
        })}
        filter={{
          label: "Filter by channel",
          selected: channels.selected,
          onToggle: channels.toggle,
        }}
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {shown.length === 0 ? (
          <Empty>
            {emptyMessage({
              status,
              filtered: channels.selected.length > 0,
              noun: "streams",
              filter: "these channels",
            })}
          </Empty>
        ) : null}
        {shown.map((stream) => (
          <article
            key={stream.id}
            data-row={stream.id}
            className="rounded-lg border border-line bg-surface-raised p-4"
          >
            <h2 className="font-medium text-ink">{stream.title}</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {CHANNEL_LABEL[stream.channel]} · {stream.channel}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

/**
 * The right column: the first stream in the response, like the other views.
 *
 * It used to report whichever stream the player had selected, held in a
 * module-scoped store that both this panel and the player read. The selection
 * is not in the query string, so it did not survive a reload and two panels
 * opened at once could disagree about what was on screen — a status line
 * reporting the wrong channel is worse than one reporting none. The first row of
 * the response is what the other six views describe, and it is a fact rather
 * than a choice that was made somewhere else.
 *
 * There is no "Live" row here, and there used to be one. The record says a
 * channel and nothing about whether anything is on it, so a state written here
 * would be the panel's guess presented as the service's answer.
 */
export function StreamDetailsPanel(): ReactElement {
  const { rows, status } = useStreams();
  const first = rows[0];

  return (
    <Panel title="Stream details">
      {first === undefined ? (
        <Empty>
          {status !== "ready"
            ? emptyMessage({ status, filtered: false, noun: "channels" })
            : "Select a stream"}
        </Empty>
      ) : (
        <KeyValues
          rows={[
            { label: "Title", value: first.title },
            { label: "Channel", value: CHANNEL_LABEL[first.channel] },
            { label: "Channel key", value: first.channel },
            { label: "Channels held", value: rows.length },
          ]}
        />
      )}
    </Panel>
  );
}

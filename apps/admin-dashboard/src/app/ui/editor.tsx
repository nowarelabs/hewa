"use client";

import { useId, useState, type ReactElement, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

import { CURRENCIES } from "@hewa/marketplace-types";
import { WRITE_ID_PREFIXES, type ConsoleWriteResource } from "@hewa/console-types";

import type { FieldFault, WriteResult } from "../mutations/_transport";

/**
 * The form every writable record is edited with, and the state behind it.
 *
 * Six resources, six sets of fields, one form. The fields are declared as data
 * rather than as JSX because the differences between the six are which columns
 * exist, what they are called, which of them are whole numbers and which are derived
 * somewhere else — and a set of `<input>`s that differs only in those is the same
 * form written six times, with six chances to spell a unit twice and to forget a
 * field on the fifth.
 *
 * ## Nothing here validates
 *
 * A field is converted to the type the contract declares and sent. Whether the
 * number is in range, whether the currency matches the book the order is resting
 * in, whether the node exists — all of that is central-api's answer to give, because
 * it is the only place the rules are written down. A browser that refused first
 * would be a second implementation of them, and the two would disagree in the
 * direction that costs an edit: a form that accepts what the service refuses reports
 * success, and the operator believes a correction that was thrown away.
 *
 * So a refusal is *shown*, per field, from the dotted paths the service sends back.
 */

/**
 * The id field a create carries and a patch does not.
 *
 * One helper rather than six hand-written specs, because the id is the same question
 * everywhere and the answer is the same: the column is the primary key and there is
 * no generator behind the service, so a create has to name its row. A form that
 * omitted it would be refused for a field the operator never saw — `expected string,
 * received undefined` at `id` — and a form that asked them to invent one by hand would
 * be asking for a UUID they have no way to know.
 *
 * It opens on a generated key carrying the resource's own prefix, and the operator can
 * replace it: `WRITE_ID_PREFIXES` is a convention from the seed data rather than a
 * constraint the schema enforces, so a caller who has a better id should be able to
 * type it. The field is a text input rather than a locked read-only row, because a key
 * that cannot be read before the record exists has nothing to display.
 */
export function editorIdField(resource: ConsoleWriteResource): FieldSpec {
  return {
    name: "id",
    label: "Id",
    kind: "text",
    createOnly: true,
    fresh: () => newWriteId(resource),
    hint: "The row's own key. Generated here; replace it with one you already use.",
  };
}

/**
 * A fresh key for a resource, from its own prefix.
 *
 * 32 bits of randomness rather than 128, because this is an operator typing into a
 * form on a development console rather than a distributed id: the id is only ever
 * compared with itself, and `ord-3f9a2c11` is one somebody can read back over a
 * shoulder. `crypto` rather than `Math.random`, because a key that collides is a
 * `duplicate key` refusal on a save nobody expected to fail.
 */
function newWriteId(resource: ConsoleWriteResource): string {
  const random = new Uint8Array(4);
  crypto.getRandomValues(random);
  const hex = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${WRITE_ID_PREFIXES[resource]}${hex}`;
}

/**
 * The currencies, as the one list every money field in the app draws from.
 *
 * From the package rather than typed out in a panel, because a currency a form does
 * not offer is a currency an operator cannot write, and six panels each listing two
 * of the three is how the third gets forgotten.
 */
export const CURRENCY_FIELDS: readonly { readonly value: string; readonly label: string }[] =
  CURRENCIES.map((value) => ({ value, label: value }));

/** How one value is entered, and therefore how it is read back. */
export type FieldKind = "text" | "number" | "select" | "instant" | "multiline";

/** One editable column. */
export interface FieldSpec {
  /**
   * Where the value lives in the body, dotted: `sla.targetBps` is nested and `kind`
   * is flat. The same string the service uses in a Zod issue's `path`, which is how
   * a refusal finds the input it is about.
   */
  readonly name: string;
  readonly label: string;
  readonly kind: FieldKind;
  /** Options for a `select`. The vocabulary comes from the contract, never from here. */
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  /** Bounds for a `number`, in the unit the column is stored in. */
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /** Shown under the input: what the unit is, or what the number means. */
  readonly hint?: string;
  /** An empty input is sent as `null` rather than omitted. */
  readonly nullable?: boolean;

  /**
   * Sent on a create and never on a patch.
   *
   * The id is the one column a create adds and a patch may not touch: the service's
   * patch schemas are strict, so an `id` on a `PATCH` is an unrecognised key and the
   * refusal names a field the operator cannot see in the form. A field carrying this
   * is also shown locked while editing, because a row's id is not a value anybody
   * edits — it is how the row is addressed.
   */
  readonly createOnly?: boolean;

  /**
   * A value for this field when there is nothing to read for it.
   *
   * For the id, which the record cannot supply before the record exists. Called once
   * per form rather than per render, so a key does not change underneath a cursor
   * that is still typing into it.
   */
  readonly fresh?: () => string;
  /**
   * Not editable while editing an existing record, with the reason.
   *
   * For a column that is not this form's to change: a spot's `observedAt` is half of
   * the key that makes it the same spot, so editing it does not correct that row, it
   * writes a different one. It stays editable when creating, because a new
   * observation's time is the thing being recorded.
   */
  readonly lockedWhenEditing?: string;
}

/**
 * What it takes to edit one resource's records.
 *
 * The three writes are passed in rather than derived, because which one a save is
 * depends on the panel: an existing row is a `PUT` and a new one a `POST`, and the
 * difference between them is a state machine's worth of behaviour that six copies of
 * this form would each reimplement.
 */
export interface RecordWriteOptions<TRecord> {
  /** The rows the panel is already showing, so a save can refuse an unknown id. */
  readonly rows: readonly TRecord[];
  /** The selected row's id, or `null` for nothing selected. */
  readonly selected: string | null;
  readonly keyOf: (row: TRecord) => string;
  /**
   * `WriteResult<unknown>`, not `WriteResult<TRecord>`.
   *
   * The record a write answers with is the service's read shape, while the rows this
   * hook is given are write-shaped — the two differ for the three resources whose
   * read side holds money as an object. Nothing here reads it: a save refetches, and
   * the row that comes back is the one the list draws. Typing it as `TRecord` would
   * either be a lie or a cast in six places, for a value nobody looks at.
   */
  readonly create: (body: Record<string, unknown>) => Promise<WriteResult<unknown>>;
  /**
   * The write for a row that already exists.
   *
   * A `PATCH`, from every editor here: a form that sends only what it shows cannot
   * drop a column it does not know about, and cannot send a derived one. A `PUT` is
   * the whole record, which is the right request for a machine and the wrong one for
   * a form whose field list will lag the contract by one release.
   */
  readonly save: (id: string, body: Record<string, unknown>) => Promise<WriteResult<unknown>>;
  /** Absent where the contract has no removal. */
  readonly remove?: (id: string) => Promise<WriteResult<unknown>>;
  /** Called after a write that landed, so the list is refetched. */
  readonly onSaved: () => void;
}

/** Everything a panel needs to draw its editor, and nothing it does not. */
export interface RecordWrite {
  /** `edit` is the selected row; `new` is a blank record not in the list yet. */
  readonly mode: "edit" | "new";
  /** The selected row's id, or `null`. Doubles as the editor's seed. */
  readonly id: string | null;
  /** The record being edited, or `null` when creating or nothing is selected. */
  readonly record: Readonly<Record<string, unknown>> | null;
  readonly pending: boolean;
  readonly refusal: { readonly message: string; readonly fields: readonly FieldFault[] } | null;
  readonly saved: boolean;
  /** Whether this resource may be removed at all, per the write contract. */
  readonly canDelete: boolean;
  readonly confirmingDelete: boolean;
  readonly startNew: () => void;
  readonly cancelNew: () => void;
  readonly confirmDelete: () => void;
  readonly cancelDelete: () => void;
  readonly submit: (body: Record<string, unknown>) => Promise<void>;
  readonly remove: () => Promise<void>;
}

/**
 * The state behind one editor.
 *
 * Saving always refetches rather than writing the answer back into the inputs. The
 * service may have derived a state, stamped a time or taken the write as a correction
 * to an existing row, and the record it answers with is the truth — so it replaces
 * what the form was filled from. Patching the inputs from the response would leave a
 * form showing values the database does not hold, which is how the next save
 * overwrites something.
 *
 * A failure of either kind keeps the operator's input. Refusing a save and clearing
 * the form is the one behaviour guaranteed to lose work.
 */
export function useRecordWrite<TRecord>({
  rows,
  selected,
  keyOf,
  create,
  save,
  remove,
  onSaved,
}: RecordWriteOptions<TRecord>): RecordWrite {
  const [mode, setMode] = useState<"edit" | "new">("edit");
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<RecordWrite["refusal"]>(null);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  //
  // `selected` is the shell's destination id, and the row a destination is about is
  // the one every panel in it names: the selected row where the ids coincide, and
  // otherwise the section's first row, which is the row its details panel shows
  // too. An editor that picked a different row from the panel above it would be
  // editing something the operator cannot see.
  const existing = rows.find((row) => keyOf(row) === selected) ?? rows[0];
  const id = existing === undefined ? null : keyOf(existing);

  async function run(action: () => Promise<WriteResult<unknown>>): Promise<void> {
    setPending(true);
    setRefusal(null);
    setSaved(false);

    const result = await action();
    setPending(false);

    if (result.status !== "ok") {
      setRefusal({ message: result.message, fields: result.fields });
      return;
    }

    setRefusal(null);
    setSaved(true);
    setConfirmingDelete(false);
    setMode("edit");
    onSaved();
  }

  return {
    mode,
    id: mode === "new" ? null : id,
    record: mode === "new" || existing === undefined ? null : asFormRecord(existing),
    pending,
    refusal,
    saved,
    canDelete: remove !== undefined && mode === "edit",
    confirmingDelete,
    startNew: () => {
      setMode("new");
      setRefusal(null);
      setSaved(false);
    },
    cancelNew: () => {
      setMode("edit");
      setRefusal(null);
      setSaved(false);
    },
    confirmDelete: () => setConfirmingDelete(true),
    cancelDelete: () => setConfirmingDelete(false),
    submit: async (body) => {
      // A save in `new` mode with a row selected would be ambiguous, so the mode is
      // the only thing that decides it: creating makes a record, editing replaces
      // one that the list already holds.
      await run(() => (mode === "new" || id === null ? create(body) : save(id, body)));
    },
    remove: async () => {
      if (remove === undefined || id === null) {
        return;
      }
      await run(() => remove(id));
    },
  };
}

export interface RecordEditorProps {
  /** What this panel is editing, in the operator's words. */
  readonly noun: string;
  /** Read-only context above the form: the figures the form is not asking for. */
  readonly summary?: ReactNode;
  readonly fields: readonly FieldSpec[];
  readonly write: RecordWrite;
  readonly submitLabel: string;
  readonly deleteLabel?: string;
  /** True when there is a row to edit and the operator may start a new one instead. */
  readonly canCreate?: boolean;
}

/**
 * An editor for one record, or for a new one.
 *
 * The `role="alert"` region is always in the document rather than inserted on
 * failure, so a refusal is announced where the reader already is instead of moving
 * their focus — and so the row of buttons does not shift under a pointer that was
 * already on its way to Save.
 */
export function RecordEditor({
  noun,
  summary,
  fields,
  write,
  submitLabel,
  deleteLabel = "Delete",
  canCreate = true,
}: RecordEditorProps): ReactElement {
  // Re-seed the inputs by keying on the record's identity, rather than with an
  // effect: an effect that resets state whenever the subject's data arrives would
  // throw away what an operator had typed because an unrelated row came back from a
  // refetch, and would do it after the keystroke they are in the middle of.
  const seed = `${write.mode}:${write.id ?? "none"}`;

  return (
    <FormBody
      key={seed}
      noun={noun}
      summary={summary}
      fields={fields}
      write={write}
      submitLabel={submitLabel}
      deleteLabel={deleteLabel}
      canCreate={canCreate}
    />
  );
}

/** The form, holding the operator's input for as long as it is pointed at one row. */
function FormBody({
  noun,
  summary,
  fields,
  write,
  submitLabel,
  deleteLabel,
  canCreate,
}: Omit<RecordEditorProps, "title">): ReactElement {
  const label = deleteLabel ?? "Delete";
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(fields, write.record),
  );
  const formId = useId();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void write.submit(bodyFrom(fields, values, write.record, write.mode));
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-muted">
          {write.mode === "new" ? `New ${noun}` : `Editing this ${noun}`}
        </p>
        {canCreate && write.mode === "edit" ? (
          <button
            type="button"
            onClick={write.startNew}
            className="rounded border border-line px-2 py-1 text-xs text-ink-muted"
          >
            New {noun}
          </button>
        ) : write.mode === "new" ? (
          <button
            type="button"
            onClick={write.cancelNew}
            className="rounded border border-line px-2 py-1 text-xs text-ink-muted"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {summary === undefined ? null : <div className="mb-1">{summary}</div>}

      {fields.map((field) => (
        <Field
          key={field.name}
          formId={formId}
          field={field}
          locked={lockedBecause(field, write.mode)}
          value={values[field.name] ?? ""}
          fault={write.refusal?.fields.find((f) => f.path === field.name)?.message}
          disabled={write.pending}
          onChange={(value) => setValues((values) => ({ ...values, [field.name]: value }))}
        />
      ))}

      <div role="alert" aria-live="assertive" className="min-h-4 text-xs text-danger">
        {write.refusal?.message ?? ""}
      </div>

      {write.saved ? <p className="text-xs text-accent">Saved</p> : null}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={write.pending}
          className="rounded bg-accent px-3 py-1 text-xs font-medium text-surface disabled:opacity-50"
        >
          {write.pending ? "Saving…" : submitLabel}
        </button>

        {!write.canDelete ? null : write.confirmingDelete ? (
          <>
            <button
              type="button"
              disabled={write.pending}
              onClick={() => void write.remove()}
              className="rounded bg-danger px-3 py-1 text-xs font-medium text-surface disabled:opacity-50"
            >
              Confirm {label.toLowerCase()}
            </button>
            <button
              type="button"
              disabled={write.pending}
              onClick={write.cancelDelete}
              className="rounded border border-line px-3 py-1 text-xs text-ink"
            >
              Keep
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={write.pending}
            onClick={write.confirmDelete}
            className="flex items-center gap-1 rounded border border-line px-3 py-1 text-xs text-ink-muted disabled:opacity-50"
          >
            <Trash2 size={12} aria-hidden />
            {deleteLabel}
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Why this field is read-only right now, or nothing.
 *
 * The reason travels with the spec so it is stated next to the field rather than
 * being a tooltip somebody adds once: an input that will not take a keystroke with
 * no explanation is read as a broken control.
 */
function lockedBecause(field: FieldSpec, mode: "edit" | "new"): string | undefined {
  return field.lockedWhenEditing !== undefined && mode === "edit"
    ? field.lockedWhenEditing
    : undefined;
}

/** One labelled input, with its hint, its fault and its locked reason. */
function Field({
  formId,
  field,
  locked,
  value,
  fault,
  disabled,
  onChange,
}: {
  formId: string;
  field: FieldSpec;
  locked: string | undefined;
  value: string;
  fault: string | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
}): ReactElement {
  const id = `${formId}-${field.name}`;
  const common = {
    id,
    name: field.name,
    disabled: locked !== undefined || disabled,
    "aria-invalid": fault !== undefined,
    "aria-describedby": fault === undefined ? undefined : `${id}-fault`,
    className: `w-full rounded border bg-surface px-2 py-1 text-sm text-ink ${
      fault === undefined ? "border-line" : "border-danger"
    }`,
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {field.label}
      </label>

      {field.kind === "select" ? (
        // A native control rather than this app's `Dropdown`: this is a form field
        // in a labelled group, and it has to work with the keyboard, with a screen
        // reader and with a phone's picker — none of which a listbox with a portal
        // and a pointer target can promise.
        <select {...common} value={value} onChange={(event) => onChange(event.target.value)}>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.kind === "multiline" ? (
        <textarea
          {...common}
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          {...common}
          type={inputType(field.kind)}
          step={field.step}
          min={field.min}
          max={field.max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {fault === undefined ? null : (
        <p id={`${id}-fault`} className="text-xs text-danger">
          {fault}
        </p>
      )}

      {(locked ?? field.hint) ? (
        <p className="text-xs text-ink-muted">{locked ?? field.hint}</p>
      ) : null}
    </div>
  );
}

/** `instant` is a local date and time; the service wants an instant. */
function inputType(kind: FieldKind): string {
  switch (kind) {
    case "number":
      return "number";
    case "instant":
      return "datetime-local";
    default:
      return "text";
  }
}

/**
 * The record as the inputs that edit it show.
 *
 * Numbers are entered as text so a half-typed `10` is not read as `1` and an empty
 * input is `""` rather than a silent `0`. An instant is local, because that is what
 * `datetime-local` shows. The inverse is {@link bodyFrom}.
 */
function initialValues(
  fields: readonly FieldSpec[],
  record: Readonly<Record<string, unknown>> | null,
): Record<string, string> {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      initialText(field, record === null ? undefined : readPath(record, field.name)),
    ]),
  );
}

/**
 * The text an input opens with, for one field.
 *
 * A `<select>` is the case worth naming. Its `value` has to match one of its options
 * or the element cannot hold it: with `value=""` and no option of that name, the
 * browser draws the *first* option while React's state still says `""`, so an
 * operator who never touched the control would save an empty string and be told
 * `expected one of "bid"|"offer"` by a form that is visibly showing `bid`. A select
 * therefore starts on its first option, which is what it is already displaying.
 *
 * An empty text field is left empty — a `fresh` value is a fallback for a field the
 * record cannot hold yet, not a way of pre-filling every blank.
 */
function initialText(field: FieldSpec, held: unknown): string {
  const text = asInputText(held, field.kind);

  if (text !== "") {
    return text;
  }

  return field.kind === "select" ? (field.options?.[0]?.value ?? "") : (field.fresh?.() ?? "");
}

/**
 * A loaded value as text for the input that edits it.
 *
 * A `Date` is read through its ISO form rather than `String(date)`, because what the
 * input needs is an instant and a locale-formatted string is not one — it is a
 * rendering of one, in a format this form cannot parse back.
 */
function asInputText(raw: unknown, kind: FieldKind): string {
  if (raw === undefined || raw === null) {
    return "";
  }

  if (raw instanceof Date) {
    return kind === "instant" ? toLocalInput(raw.toISOString()) : "";
  }

  if (typeof raw === "number" || typeof raw === "boolean") {
    return String(raw);
  }

  if (typeof raw !== "string") {
    // An object where a column should be. Rendering it would put `[object Object]`
    // into an input and save that back, so the field is blank and any refusal is
    // then about the value rather than about what this did to it.
    return "";
  }

  return kind === "instant" ? toLocalInput(raw) : raw;
}

/**
 * The body the service is sent.
 *
 * Only the fields this form declares, taken from the form's own inputs, nested by
 * `name`. Nothing else in the record is copied across: a `PUT` is a whole record, so
 * a column the form does not show would be dropped rather than preserved — which is
 * why each resource's `fields` covers its write contract in full, and why a column
 * the service derives (`state`, a money total) is not among them.
 *
 * A `lockedWhenEditing` field keeps the value it was loaded with, so a read-only
 * column of a `PUT` is not dropped by a form that cannot change it.
 */
function bodyFrom(
  fields: readonly FieldSpec[],
  values: Readonly<Record<string, string>>,
  record: Readonly<Record<string, unknown>> | null,
  mode: "edit" | "new",
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  for (const field of fields) {
    // Skipped rather than sent as `undefined`: the patch schemas are strict, so an
    // `id` on a `PATCH` comes back as an unrecognised key — a refusal about a field
    // the operator is not looking at, on a save they did not ask for.
    if (field.createOnly === true && mode === "edit") {
      continue;
    }

    const text = values[field.name] ?? "";
    const held = record === null ? undefined : readPath(record, field.name);

    const value: unknown =
      field.lockedWhenEditing !== undefined && mode === "edit"
        ? held
        : text === ""
          ? field.nullable
            ? null
            : held
          : field.kind === "number"
            ? Number(text)
            : field.kind === "instant"
              ? new Date(text).toISOString()
              : text;

    writePath(body, field.name, value);
  }

  return body;
}

/**
 * The form's assembled body as the contract's body type.
 *
 * The form builds a body by walking its own `FieldSpec` list, so the shape it
 * produces is `Record<string, unknown>` until somebody says it is an `AlertWrite`.
 * This is that somebody, and it is one function rather than six casts so the reason
 * is written once: the columns are checked against the contract by
 * `editor-fields.test.ts`, which fails if a field list and a write contract drift
 * apart, and the service is the authority on the values.
 *
 * A cast, not a validator. Adding a range check here would be a second answer to
 * every rule in `write-schemas.ts`, and the two would disagree in the direction that
 * loses an edit.
 */
export function asWrite<TBody>(body: Record<string, unknown>): TBody {
  return body as TBody;
}

/**
 * A record as the form's dotted paths address it.
 *
 * The cast is because an `interface` has no implicit index signature, so
 * `InfrastructureNode` is not assignable to `Record<string, unknown>` even though
 * every one of its properties is. It is here rather than at each of the six call
 * sites so the reason is written once.
 */
export function asFormRecord<TRecord>(row: TRecord): Readonly<Record<string, unknown>> {
  return row as unknown as Readonly<Record<string, unknown>>;
}

/** Read a dotted path out of a record. */
function readPath(record: Readonly<Record<string, unknown>>, path: string): unknown {
  let node: unknown = record;
  for (const key of path.split(".")) {
    if (typeof node !== "object" || node === null) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

/** Write a dotted path into a body, creating the objects along the way. */
function writePath(body: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let node = body;

  for (const key of keys.slice(0, -1)) {
    const next = (node[key] ?? {}) as Record<string, unknown>;
    node[key] = next;
    node = next;
  }

  const last = keys.at(-1);
  if (last !== undefined) {
    node[last] = value;
  }
}

/**
 * An instant as a `datetime-local` value: local wall time, no zone.
 *
 * `toISOString` would answer in UTC and put the input hours either side of the
 * moment it names on a machine not on UTC — and an operator correcting an
 * observation would then write a time that is not the one they read.
 */
function toLocalInput(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) {
    return iso;
  }

  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

import { isMultiPin, normalizeBody } from "./connectorbody";
import type { TableColumns } from "./doc";
import type { ConnectorBody, HarnessDoc, HNode, WireDefaults } from "./types";

/**
 * What a new wire or a new connector starts with.
 *
 * They are only ever filled into what is empty: a defaults setting is a place to
 * start from, and nothing somebody has written is changed by it. It is kept in
 * the drawing, because a harness is usually built from one kind of wire and the
 * next person to open the file should get the same starting point.
 */

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Defaults read from a file: trimmed, and absent when there is nothing in them. */
export function normalizeDefaults(raw: unknown): WireDefaults | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const src = raw as Record<string, unknown>;
  const defaults: WireDefaults = {
    color: text(src["color"]),
    size: text(src["size"]),
    type: text(src["type"]),
  };
  const body = normalizeBody(src["body"]);
  if (body) defaults.body = body;
  return defaults.color || defaults.size || defaults.type || defaults.body ? defaults : undefined;
}

/** Changes the wire defaults, leaving the document without any when none is left. Mutates the document. */
export function setDefaults(
  doc: HarnessDoc,
  patch: Partial<Pick<WireDefaults, "color" | "size" | "type">>,
): void {
  const next: WireDefaults = { color: "", size: "", type: "", ...doc.defaults, ...patch };
  const body = doc.defaults?.body;
  delete next.body;
  if (body) next.body = body;
  keep(doc, next);
}

/** Sets, or with nothing clears, the default connector body. Mutates the document. */
export function setDefaultBody(doc: HarnessDoc, body: ConnectorBody | undefined): void {
  const next: WireDefaults = { color: "", size: "", type: "", ...doc.defaults };
  delete next.body;
  if (body) next.body = body;
  keep(doc, next);
}

function keep(doc: HarnessDoc, next: WireDefaults): void {
  const kept = normalizeDefaults(next);
  if (kept) doc.defaults = kept;
  else delete doc.defaults;
}

/** Fills the colour, size and type a wire row has none of with the defaults. Mutates the row. */
export function applyWireDefaults(
  row: string[],
  cols: TableColumns,
  defaults: WireDefaults | undefined,
): void {
  if (!defaults) return;
  const wanted: ReadonlyArray<readonly [number | undefined, string]> = [
    [cols.color, defaults.color],
    [cols.section, defaults.size],
    [cols.type, defaults.type],
  ];
  for (const [col, value] of wanted) {
    if (col === undefined || !value || String(row[col] ?? "").trim()) continue;
    while (row.length <= col) row.push("");
    row[col] = value;
  }
}

/** Gives a connector that has just become a multi-pin one the default body, if it has none. Mutates the node. */
export function applyBodyDefault(node: HNode, defaults: WireDefaults | undefined): void {
  if (node.body || !defaults?.body || !isMultiPin(node)) return;
  node.body = { ...defaults.body };
}

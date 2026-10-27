import type { BodyForm, ConnectorBody, HarnessDoc, HNode } from "./types";

/**
 * The connector body: what a multi-pin connector physically is, as opposed to
 * how it is drawn. Plug or receptacle, who makes it, which series, what to call
 * it, and the part number to order it by.
 *
 * It belongs to the connector and not to its symbol, which is the point: a
 * connector drawn as a ring terminal for a moment, or switched to a splice and
 * back, keeps the body it had. Nothing here ever clears one — only taking it
 * off on purpose does.
 */

export const BODY_FORMS: readonly BodyForm[] = ["plug", "receptacle"];

/** The symbols that stand for a connector with several cavities. */
const SINGLE_WAY_STYLES = new Set(["ring", "faston", "pin", "splice", "none"]);

/** True when the node is drawn as a multi-pin connector, which is the only kind a body applies to. */
export const isMultiPin = (node: HNode): boolean =>
  node.kind === "connector" && !SINGLE_WAY_STYLES.has(node.style);

export const emptyBody = (): ConnectorBody => ({
  form: "",
  manufacturer: "",
  series: "",
  description: "",
  partNumber: "",
});

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** A body read from a file or a form: trimmed, and absent when there is nothing in it. */
export function normalizeBody(raw: unknown): ConnectorBody | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const src = raw as Record<string, unknown>;
  const form = (BODY_FORMS as readonly unknown[]).includes(src["form"]) ? (src["form"] as BodyForm) : "";
  const body: ConnectorBody = {
    form,
    manufacturer: text(src["manufacturer"]),
    series: text(src["series"]),
    description: text(src["description"]),
    partNumber: text(src["partNumber"]),
  };
  return Object.values(body).some(Boolean) ? body : undefined;
}

/** What makes two bodies the same one: the same part, from the same maker, in the same form. */
export const bodyKey = (b: ConnectorBody): string =>
  [b.manufacturer, b.series, b.partNumber, b.form].map((s) => s.trim().toLowerCase()).join("|");

/** One line for a body: the part number or the series first, then what it is and who makes it. */
export function bodyLabel(b: ConnectorBody): string {
  const head = b.partNumber || b.series || b.description;
  const rest = [b.form, b.partNumber ? b.series : "", b.manufacturer].filter(Boolean).join(", ");
  return rest ? `${head} — ${rest}` : head;
}

/** The short line drawn under a connector on the sheet: what to ask for, and in which form. */
export const bodyCaption = (b: ConnectorBody): string =>
  [b.partNumber || b.series || b.description, b.form].filter(Boolean).join(" · ");

const TE = "TE Connectivity (DEUTSCH)";
const APTIV = "Aptiv (Delphi)";

const dtm = (form: BodyForm, part: string, ways: number, extra = ""): ConnectorBody => ({
  form,
  manufacturer: TE,
  series: "DTM",
  description: `${ways}-way ${form}${form === "plug" ? ", pin contacts" : ", socket contacts"}${extra}`,
  partNumber: part,
});

/**
 * A few bodies to start from, because the first one entered is the slowest:
 * the DEUTSCH DTM plugs and receptacles, and the Metri-Pack series. It is a
 * starting point and not a catalogue — anything else is typed in once and is
 * offered from then on.
 */
export const BUILT_IN_BODIES: readonly ConnectorBody[] = [
  dtm("receptacle", "DTM06-2S", 2),
  dtm("receptacle", "DTM06-3S", 3),
  dtm("receptacle", "DTM06-4S", 4),
  dtm("receptacle", "DTM06-6S", 6),
  dtm("receptacle", "DTM06-08SA", 8, ", A key"),
  dtm("receptacle", "DTM06-12SA", 12, ", A key"),
  dtm("plug", "DTM04-2P", 2),
  dtm("plug", "DTM04-3P", 3),
  dtm("plug", "DTM04-4P", 4),
  dtm("plug", "DTM04-6P", 6),
  dtm("plug", "DTM04-08PA", 8, ", A key"),
  dtm("plug", "DTM04-12PA", 12, ", A key"),
  {
    form: "",
    manufacturer: APTIV,
    series: "Metri-Pack 150",
    description: "sealed, 1.5 mm terminals",
    partNumber: "",
  },
  {
    form: "",
    manufacturer: APTIV,
    series: "Metri-Pack 280",
    description: "sealed, 2.8 mm terminals",
    partNumber: "",
  },
  {
    form: "",
    manufacturer: APTIV,
    series: "Metri-Pack 480",
    description: "sealed, 4.8 mm terminals",
    partNumber: "",
  },
  {
    form: "",
    manufacturer: APTIV,
    series: "Metri-Pack 630",
    description: "sealed, 6.3 mm terminals",
    partNumber: "",
  },
];

/** The bodies the drawing itself uses, in the order its connectors come. */
export function bodiesInDoc(doc: HarnessDoc): ConnectorBody[] {
  const out: ConnectorBody[] = [];
  for (const node of doc.nodes) if (node.body) out.push(node.body);
  return out;
}

/**
 * Everything that can be picked: the built-in starting points, the bodies kept
 * from earlier drawings, and the ones this drawing uses — so a file opened
 * somewhere else still offers its own. One entry per body, sorted by maker and
 * then by what it is called.
 */
export function bodyLibrary(doc: HarnessDoc, saved: readonly ConnectorBody[]): ConnectorBody[] {
  const seen = new Map<string, ConnectorBody>();
  for (const body of [...BUILT_IN_BODIES, ...saved, ...bodiesInDoc(doc)]) {
    const key = bodyKey(body);
    if (!seen.has(key)) seen.set(key, body);
  }
  return [...seen.values()].sort(
    (a, b) =>
      a.manufacturer.localeCompare(b.manufacturer) ||
      a.series.localeCompare(b.series) ||
      a.partNumber.localeCompare(b.partNumber, undefined, { numeric: true }) ||
      a.form.localeCompare(b.form),
  );
}

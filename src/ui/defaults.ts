/**
 * The defaults for new wires and connectors, in a floating panel.
 *
 * Wire size, wire type, wire colour and connector body: what a wire starts
 * with when it is connected and what a connector starts with when it is drawn
 * as a plug. Each is a starting point only — it fills what is empty and never
 * changes what is written — and each can be left empty.
 */
import type { AppContext } from "@/app/context";
import { bodyLabel } from "@/core/connectorbody";
import { setDefaults } from "@/core/defaults";
import { colorsOf } from "@/core/colors";
import { sizesFor, unitLabel, wireUnitOf } from "@/core/wiresize";
import { WIRE_TYPES } from "@/core/wiretype";
import { openDefaultBody } from "./body";
import { openColorPicker } from "./colorpicker";
import { isPanelOpen, openPanel, refreshPanels } from "./panel";

const PANEL_ID = "defaults";

let watching = false;

function field(label: string, control: HTMLElement): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "field";
  const text = document.createElement("span");
  text.className = "field__label";
  text.textContent = label;
  wrap.append(text, control);
  return wrap;
}

function datalist(id: string, values: readonly string[]): HTMLDataListElement {
  const el = document.createElement("datalist");
  el.id = id;
  for (const value of values) el.append(new Option(value, value));
  return el;
}

function small(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn btn--small btn--outline";
  b.textContent = label;
  b.disabled = disabled;
  b.addEventListener("click", onClick);
  return b;
}

/** A text field with the usual values offered; committed when it is left or Enter is pressed. */
function suggested(
  value: string,
  list: string,
  label: string,
  commit: (value: string) => void,
): HTMLInputElement {
  const el = document.createElement("input");
  el.type = "text";
  el.value = value;
  el.autocomplete = "off";
  el.spellcheck = false;
  el.setAttribute("list", list);
  el.setAttribute("aria-label", label);
  el.addEventListener("keydown", (ev) => {
    ev.stopPropagation();
    if (ev.key === "Enter") {
      ev.preventDefault();
      el.blur();
    }
  });
  el.addEventListener("change", () => commit(el.value.trim()));
  return el;
}

/** A colour as the swatch the sheet would draw for it, with its name beside it. */
function colourChip(value: string, none: string): HTMLElement {
  const chip = document.createElement("span");
  chip.className = "defaults__chip";
  const bands = colorsOf(value);
  if (bands) {
    const swatch = document.createElement("span");
    swatch.className = "defaults__swatch";
    swatch.style.background =
      bands.length > 1
        ? `linear-gradient(90deg, ${bands.map((c, i) => `${c} ${(i * 100) / bands.length}% ${((i + 1) * 100) / bands.length}%`).join(", ")})`
        : (bands[0] ?? "");
    chip.append(swatch);
  }
  chip.append(document.createTextNode(value || none));
  return chip;
}

function render(app: AppContext, body: HTMLElement): void {
  const { t } = app;
  body.replaceChildren();
  body.classList.add("defaults");
  const defaults = app.doc.defaults;
  const unit = wireUnitOf(app.doc);

  const intro = document.createElement("p");
  intro.className = "small muted";
  intro.textContent = t("defaults.intro");
  body.append(intro);

  const set = (patch: Parameters<typeof setDefaults>[1]): void => {
    app.store.edit((doc) => setDefaults(doc, patch), "defaults");
  };

  body.append(
    datalist(
      "defaults-sizes",
      sizesFor(unit).map((s) => s.label),
    ),
    datalist("defaults-types", WIRE_TYPES),
    field(
      t("defaults.size", { unit: unitLabel(unit) }),
      suggested(
        defaults?.size ?? "",
        "defaults-sizes",
        t("defaults.size", { unit: unitLabel(unit) }),
        (size) => set({ size }),
      ),
    ),
    field(
      t("defaults.type"),
      suggested(defaults?.type ?? "", "defaults-types", t("defaults.type"), (type) => set({ type })),
    ),
  );

  const colour = document.createElement("div");
  colour.className = "stack";
  colour.append(
    colourChip(defaults?.color ?? "", t("defaults.none")),
    small(t("defaults.choose"), () =>
      openColorPicker({ value: defaults?.color ?? "", onPick: (color) => set({ color }) }),
    ),
    small(t("defaults.clear"), () => set({ color: "" }), !defaults?.color),
  );
  body.append(field(t("defaults.color"), colour));

  const connector = document.createElement("div");
  connector.className = "stack";
  const summary = document.createElement("span");
  summary.className = "defaults__chip";
  summary.textContent = defaults?.body ? bodyLabel(defaults.body) : t("defaults.none");
  connector.append(
    summary,
    small(t("defaults.choose"), () => openDefaultBody(app)),
    small(t("defaults.clear"), () => app.store.edit((doc) => clearBody(doc), "defaults"), !defaults?.body),
  );
  body.append(field(t("defaults.body"), connector));
}

/** Takes the default body off while keeping the wire defaults. */
function clearBody(doc: AppContext["doc"]): void {
  if (!doc.defaults) return;
  delete doc.defaults.body;
  if (!doc.defaults.color && !doc.defaults.size && !doc.defaults.type) delete doc.defaults;
}

export function openDefaults(app: AppContext): void {
  openPanel({
    id: PANEL_ID,
    title: app.t("defaults.title"),
    width: 340,
    dock: "top-right",
    render: (body) => render(app, body),
  });
  // the panel follows the drawing: a change of unit converts the size shown,
  // and an undo puts back what was there
  if (!watching) {
    watching = true;
    app.store.on("doc", ({ reason }) => {
      if (!isPanelOpen(PANEL_ID)) return;
      if (reason === "view" || reason === "selection" || reason === "tool") return;
      refreshPanels();
    });
  }
}

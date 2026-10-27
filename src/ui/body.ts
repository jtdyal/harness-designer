/**
 * The connector body, in a floating panel.
 *
 * Plug or receptacle, maker, series, description and part number for one
 * multi-pin connector. Picking from the library fills the fields, and the
 * fields can then be changed before applying, so a body that is nearly one on
 * the list costs one pick and one edit. Whatever is applied is kept for next
 * time and offered from then on.
 */
import type { AppContext } from "@/app/context";
import {
  BODY_FORMS,
  bodyLabel,
  bodyLibrary,
  emptyBody,
  isMultiPin,
  normalizeBody,
} from "@/core/connectorbody";
import { findNode } from "@/core/doc";
import type { BodyForm, ConnectorBody } from "@/core/types";
import { loadSavedBodies, rememberBody } from "./bodylibrary";
import { closePanel, openPanel } from "./panel";

const PANEL_ID = "body";

/** What is being edited: the connector, and the fields as they stand before Apply. */
let editing: { node: string; draft: ConnectorBody } = { node: "", draft: emptyBody() };

function field(label: string, control: HTMLElement): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "field";
  const text = document.createElement("span");
  text.className = "field__label";
  text.textContent = label;
  wrap.append(text, control);
  return wrap;
}

function input(value: string, list: string | null, onInput: (value: string) => void): HTMLInputElement {
  const el = document.createElement("input");
  el.type = "text";
  el.value = value;
  el.autocomplete = "off";
  el.spellcheck = false;
  if (list) el.setAttribute("list", list);
  el.addEventListener("input", () => onInput(el.value));
  return el;
}

function datalist(id: string, values: Iterable<string>): HTMLDataListElement {
  const el = document.createElement("datalist");
  el.id = id;
  for (const value of new Set(values)) {
    if (!value) continue;
    const option = document.createElement("option");
    option.value = value;
    el.append(option);
  }
  return el;
}

function action(label: string, onClick: () => void, variant: "primary" | "outline", disabled = false) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn btn--small btn--${variant}`;
  b.textContent = label;
  b.disabled = disabled;
  b.addEventListener("click", onClick);
  return b;
}

function render(app: AppContext, body: HTMLElement): void {
  const { t } = app;
  body.replaceChildren();
  const node = findNode(app.doc, editing.node);
  if (!node) {
    closePanel(PANEL_ID);
    return;
  }
  const { draft } = editing;
  const library = bodyLibrary(app.doc, loadSavedBodies());

  // the library, grouped by maker; picking one fills the fields below
  const pick = document.createElement("select");
  pick.setAttribute("aria-label", t("body.library"));
  pick.append(new Option(t("body.libraryPick"), ""));
  const makers = new Map<string, HTMLOptGroupElement>();
  library.forEach((entry, i) => {
    let group = makers.get(entry.manufacturer);
    if (!group) {
      group = document.createElement("optgroup");
      group.label = entry.manufacturer || t("body.noMaker");
      makers.set(entry.manufacturer, group);
      pick.append(group);
    }
    group.append(new Option(bodyLabel(entry), String(i)));
  });
  pick.addEventListener("change", () => {
    const chosen = library[Number(pick.value)];
    if (!chosen) return;
    editing.draft = { ...chosen };
    render(app, body);
  });
  body.append(field(t("body.library"), pick));

  const form = document.createElement("select");
  form.setAttribute("aria-label", t("body.form"));
  const forms: BodyForm[] = ["", ...BODY_FORMS];
  for (const value of forms) {
    form.append(new Option(t(value ? `body.form.${value}` : "body.form.none"), value));
  }
  form.value = draft.form;
  form.addEventListener("change", () => {
    editing.draft.form = form.value as BodyForm;
  });
  body.append(field(t("body.form"), form));

  body.append(
    datalist(
      "body-makers",
      library.map((b) => b.manufacturer),
    ),
    datalist(
      "body-series",
      library.map((b) => b.series),
    ),
  );
  const submit = (): void => apply(app);
  const keys = (el: HTMLInputElement): HTMLInputElement => {
    el.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") {
        ev.preventDefault();
        submit();
      }
    });
    return el;
  };
  body.append(
    field(
      t("body.manufacturer"),
      keys(input(draft.manufacturer, "body-makers", (v) => (editing.draft.manufacturer = v))),
    ),
    field(t("body.series"), keys(input(draft.series, "body-series", (v) => (editing.draft.series = v)))),
    field(
      t("body.description"),
      keys(input(draft.description, null, (v) => (editing.draft.description = v))),
    ),
    field(t("body.partNumber"), keys(input(draft.partNumber, null, (v) => (editing.draft.partNumber = v)))),
  );

  if (!isMultiPin(node)) {
    const hint = document.createElement("p");
    hint.className = "small muted";
    hint.textContent = t("body.hint.hidden");
    body.append(hint);
  }

  const buttons = document.createElement("div");
  buttons.className = "stack";
  buttons.append(
    action(t("body.apply"), submit, "primary"),
    action(t("body.remove"), () => remove(app), "outline", !node.body),
  );
  body.append(buttons);
}

/** Puts the fields on the connector and keeps the body for next time. */
function apply(app: AppContext): void {
  const body = normalizeBody(editing.draft);
  const id = editing.node;
  const name = findNode(app.doc, id)?.name ?? "";
  app.store.edit((doc) => {
    const node = findNode(doc, id);
    if (!node) return;
    if (body) node.body = body;
    else delete node.body;
  }, "body");
  if (body) rememberBody(body);
  closePanel(PANEL_ID);
  app.toast.show(app.t(body ? "body.saved" : "body.removed", { name }));
}

function remove(app: AppContext): void {
  editing.draft = emptyBody();
  apply(app);
}

/** Opens the panel for a connector. False when the node is not a connector. */
export function openConnectorBody(app: AppContext, nodeId: string): boolean {
  const node = findNode(app.doc, nodeId);
  if (!node || node.kind !== "connector") return false;
  editing = { node: nodeId, draft: { ...(node.body ?? emptyBody()) } };
  openPanel({
    id: PANEL_ID,
    title: app.t("body.title", { name: node.name || app.t("validate.nodeUnnamed") }),
    width: 340,
    dock: "top-right",
    render: (body) => render(app, body),
  });
  return true;
}

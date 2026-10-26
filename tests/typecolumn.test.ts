import { describe, expect, it } from "vitest";
import { normalizeDoc, tableColumns } from "@/core/doc";
import { addTypeColumn } from "@/core/typecolumn";
import type { HarnessDoc, Table } from "@/core/types";

const table = (id: string, head: string[], rows: string[][]): Table => ({
  id,
  x: 0,
  y: 0,
  kind: "table",
  head,
  rows,
});

const docWith = (...tables: Table[]): HarnessDoc => normalizeDoc({ tables });

describe("tableColumns", () => {
  it("recognizes a Type column in English and Italian", () => {
    expect(tableColumns(table("t", ["Cavity", "Type", "To"], [])).type).toBe(1);
    expect(tableColumns(table("t", ["Cavità", "Tipo", "Verso"], [])).type).toBe(1);
  });

  it("does not take a Type column for the cavity or the destination", () => {
    const cols = tableColumns(table("t", ["Cavity", "To", "Type"], []));
    expect(cols).toMatchObject({ cavity: 0, dest: 1, type: 2 });
  });

  it("finds none where there is no such heading", () => {
    expect(tableColumns(table("t", ["Cavity", "To", "Function"], [])).type).toBeUndefined();
  });
});

describe("addTypeColumn", () => {
  it("puts the column after the section and keeps every row in step", () => {
    const doc = docWith(
      table(
        "t",
        ["Cavity", "To", "Function", "Colour", "Section", "Notes"],
        [["1", "B.1", "Power", "Red", "1.5", "n"]],
      ),
    );
    expect(addTypeColumn(doc, "Type")).toBe(1);
    expect(doc.tables[0]?.head).toEqual(["Cavity", "To", "Function", "Colour", "Section", "Type", "Notes"]);
    expect(doc.tables[0]?.rows[0]).toEqual(["1", "B.1", "Power", "Red", "1.5", "", "n"]);
  });

  it("falls back to after the colour, then after the cavity", () => {
    const doc = docWith(
      table("a", ["Cavity", "Colour", "To"], [["1", "Red", "B.1"]]),
      table("b", ["Cavity", "To"], [["1", "B.1"]]),
    );
    addTypeColumn(doc, "Type");
    expect(doc.tables[0]?.head).toEqual(["Cavity", "Colour", "Type", "To"]);
    expect(doc.tables[1]?.head).toEqual(["Cavity", "Type", "To"]);
  });

  it("pads a row that is shorter than the place the column goes", () => {
    const doc = docWith(table("t", ["Cavity", "To", "Colour", "Section"], [["1"]]));
    addTypeColumn(doc, "Type");
    expect(doc.tables[0]?.rows[0]).toEqual(["1", "", "", "", ""]);
  });

  it("leaves tables that already have one, and tables that are not cavity tables", () => {
    const doc = docWith(
      table("a", ["Cavity", "Type", "To"], [["1", "blade", "B.1"]]),
      table("n", ["#", "Note"], [["1", "text"]]),
    );
    expect(addTypeColumn(doc, "Type")).toBe(0);
    expect(doc.tables[0]?.head).toEqual(["Cavity", "Type", "To"]);
    expect(doc.tables[1]?.head).toEqual(["#", "Note"]);
  });

  it("keeps the destination readable by the rest of the application", () => {
    const doc = docWith(table("t", ["Cavity", "To", "Colour"], [["1", "B.1", "Red"]]));
    addTypeColumn(doc, "Type");
    const cols = tableColumns(doc.tables[0]!);
    expect(cols).toMatchObject({ cavity: 0, dest: 1, color: 2, type: 3 });
    expect(doc.tables[0]?.rows[0]?.[cols.dest!]).toBe("B.1");
  });
});

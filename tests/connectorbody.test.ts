import { describe, expect, it } from "vitest";
import {
  BUILT_IN_BODIES,
  bodyCaption,
  bodyKey,
  bodyLabel,
  bodyLibrary,
  isMultiPin,
  normalizeBody,
} from "@/core/connectorbody";
import { cloneDoc, normalizeDoc } from "@/core/doc";
import type { ConnectorBody, HarnessDoc } from "@/core/types";

const body = (over: Partial<ConnectorBody> = {}): ConnectorBody => ({
  form: "plug",
  manufacturer: "Acme",
  series: "Z1",
  description: "4-way",
  partNumber: "Z1-4P",
  ...over,
});

const docWith = (nodeBody?: unknown, style = "plug"): HarnessDoc =>
  normalizeDoc({ nodes: [{ id: "a", x: 0, y: 0, kind: "connector", name: "A", style, body: nodeBody }] });

describe("normalizeBody", () => {
  it("trims, and keeps the plug or receptacle", () => {
    expect(normalizeBody({ form: "receptacle", manufacturer: "  Acme ", series: "Z1" })).toEqual({
      form: "receptacle",
      manufacturer: "Acme",
      series: "Z1",
      description: "",
      partNumber: "",
    });
  });

  it("is nothing when there is nothing in it", () => {
    expect(normalizeBody({})).toBeUndefined();
    expect(normalizeBody({ form: "plug" })).toMatchObject({ form: "plug" });
    expect(normalizeBody({ manufacturer: "   " })).toBeUndefined();
    expect(normalizeBody(null)).toBeUndefined();
    expect(normalizeBody("plug")).toBeUndefined();
  });

  it("ignores a form it does not know", () => {
    expect(normalizeBody({ form: "adapter", series: "Z1" })?.form).toBe("");
  });
});

describe("isMultiPin", () => {
  const style = (s: string) => docWith(undefined, s).nodes[0]!;

  it("is true for the multi-pin symbol and for one a plugin adds", () => {
    expect(isMultiPin(style("plug"))).toBe(true);
    expect(isMultiPin(style("sealed-housing"))).toBe(true);
  });

  it("is false for terminals and splices, and for a junction", () => {
    for (const s of ["ring", "faston", "pin", "splice", "none"]) expect(isMultiPin(style(s))).toBe(false);
    expect(isMultiPin({ ...style("plug"), kind: "junction" })).toBe(false);
  });
});

describe("a body on a connector", () => {
  it("is read from a file and written back", () => {
    const doc = docWith(body());
    expect(doc.nodes[0]?.body).toEqual(body());
    expect(normalizeDoc(JSON.parse(JSON.stringify(doc))).nodes[0]?.body).toEqual(body());
    expect(cloneDoc(doc).nodes[0]?.body).toEqual(body());
  });

  it("is dropped when it holds nothing, so a file stays free of empty bodies", () => {
    expect(docWith({ form: "", series: "" }).nodes[0]?.body).toBeUndefined();
  });

  it("survives the connector being drawn as something else and back", () => {
    const doc = docWith(body());
    const node = doc.nodes[0]!;
    for (const style of ["ring", "splice", "faston", "plug"]) {
      node.style = style;
      const again = normalizeDoc(JSON.parse(JSON.stringify(doc)));
      expect(again.nodes[0]?.body).toEqual(body());
    }
  });
});

describe("labels", () => {
  it("names a body by its part number first", () => {
    expect(bodyLabel(body())).toBe("Z1-4P — plug, Z1, Acme");
    expect(bodyLabel(body({ partNumber: "" }))).toBe("Z1 — plug, Acme");
    expect(bodyCaption(body())).toBe("Z1-4P · plug");
    expect(bodyCaption(body({ form: "", partNumber: "" }))).toBe("Z1");
  });
});

describe("bodyLibrary", () => {
  it("starts with the DEUTSCH DTM and the Metri-Pack series", () => {
    const lib = bodyLibrary(docWith(), []);
    expect(lib.map((b) => b.partNumber)).toEqual(
      expect.arrayContaining(["DTM04-2P", "DTM06-2S", "DTM06-12SA"]),
    );
    expect(lib.some((b) => b.series === "Metri-Pack 150")).toBe(true);
    expect(lib).toHaveLength(BUILT_IN_BODIES.length);
  });

  it("offers what the drawing uses and what was kept from other drawings", () => {
    const lib = bodyLibrary(docWith(body({ partNumber: "IN-DOC" })), [body({ partNumber: "KEPT" })]);
    const parts = lib.map((b) => b.partNumber);
    expect(parts).toContain("IN-DOC");
    expect(parts).toContain("KEPT");
  });

  it("lists a body once, however many places it comes from", () => {
    const dtm = BUILT_IN_BODIES[0] as ConnectorBody;
    const lib = bodyLibrary(docWith({ ...dtm }), [{ ...dtm }]);
    expect(lib.filter((b) => bodyKey(b) === bodyKey(dtm))).toHaveLength(1);
  });

  it("sorts by maker, then series, then part number in order of size", () => {
    const parts = bodyLibrary(docWith(), [])
      .filter((b) => b.series === "DTM" && b.form === "plug")
      .map((b) => b.partNumber);
    expect(parts).toEqual(["DTM04-2P", "DTM04-3P", "DTM04-4P", "DTM04-6P", "DTM04-8P", "DTM04-12PA"]);
  });

  it("tells a plug from a receptacle of the same part", () => {
    expect(bodyKey(body({ form: "plug" }))).not.toBe(bodyKey(body({ form: "receptacle" })));
    expect(bodyKey(body({ manufacturer: "ACME" }))).toBe(bodyKey(body()));
  });
});

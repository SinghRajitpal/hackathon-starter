import { describe, expect, it } from "vitest";
import { normaliseSector, type RawRow } from "./transform";
import { DEFAULT_OPTIONS } from "./types";

const rows: RawRow[] = [
  { ticker: "A", tbr: 0, de: 0.5, ben: null, ndEbitda: 1, fcfMargin: 0.1 },
  { ticker: "B", tbr: 1, de: 0.0, ben: 0.2, ndEbitda: 3, fcfMargin: null },
  { ticker: "C", tbr: 3, de: 1.0, ben: 0.0, ndEbitda: 2, fcfMargin: 0.3 },
];

describe("normaliseSector", () => {
  const out = normaliseSector(rows, { ...DEFAULT_OPTIONS, winsorise: false });

  it("log-transforms TBR and flips cost variables so 1 is best", () => {
    expect(out.map((r) => r.x.tbr)).toEqual([1, expect.closeTo(0.5, 9), 0]);
    expect(out.map((r) => r.x.de)).toEqual([0.5, 1, 0]);
  });

  it("treats null BEN as 0 with a flag and imputes FCF margin with the sector median", () => {
    expect(out.map((r) => r.x.ben)).toEqual([0, 1, 0]);
    expect(out[0].flags).toContain("ben-unclassified-zero");
    expect(out.map((r) => r.x.fcfMargin)).toEqual([0, expect.closeTo(0.5, 9), 1]);
    expect(out[1].flags).toContain("fcf-margin-imputed");
  });

  it("scores leverage as distance from the sector median target", () => {
    expect(out.map((r) => r.x.leverage)).toEqual([0, 0, 1]);
  });

  it("maps a constant column to 1", () => {
    const flat = normaliseSector(rows.map((r) => ({ ...r, de: 0.4 })), DEFAULT_OPTIONS);
    expect(flat.map((r) => r.x.de)).toEqual([1, 1, 1]);
  });
});

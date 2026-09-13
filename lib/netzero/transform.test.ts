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

  it("winsorises TBR at the sector 97.5th percentile before the log transform", () => {
    // quantile([0, 1, 3], 0.975) = 2.9, so TBR becomes [0, 1, 2.9] before log1p.
    // Without winsorising, the middle value would be log1p(1)/log1p(3) => 0.5.
    const winsorised = normaliseSector(rows, DEFAULT_OPTIONS);
    expect(winsorised.map((r) => r.x.tbr)).toEqual([
      1,
      expect.closeTo(1 - Math.log(2) / Math.log(3.9), 9),
      0,
    ]);
  });

  it("fills missing leverage inputs with the sector median before scoring distance from target", () => {
    const leverageRows = rows.map((r, i) => ({ ...r, ndEbitda: [1, null, 3][i] }));
    const out2 = normaliseSector(leverageRows, { ...DEFAULT_OPTIONS, winsorise: false });
    expect(out2.map((r) => r.x.leverage)).toEqual([0, 1, 0]);
    expect(out2[1].flags).toContain("leverage-imputed");
    expect(out2[0].flags).not.toContain("leverage-imputed");
    expect(out2[2].flags).not.toContain("leverage-imputed");
  });

  it("scores a negative-EBITDA-with-debt company as the sector's worst leverage distance", () => {
    // target = median(1, 10, 3) = 3; distances 2, 0, 7; the flagged row is forced to the max (7),
    // which ties it with the genuinely worst company (C) rather than collapsing the whole column.
    const negativeEbitdaRows: RawRow[] = [
      { ticker: "A", tbr: 0, de: 0.5, ben: 0.1, ndEbitda: 1, fcfMargin: 0.1 },
      { ticker: "B", tbr: 1, de: 0.3, ben: 0.1, ndEbitda: null, fcfMargin: 0.1, negativeEbitdaWithDebt: true },
      { ticker: "C", tbr: 2, de: 0.2, ben: 0.1, ndEbitda: 10, fcfMargin: 0.1 },
      { ticker: "D", tbr: 3, de: 0.1, ben: 0.1, ndEbitda: 3, fcfMargin: 0.1 },
    ];
    const out3 = normaliseSector(negativeEbitdaRows, { ...DEFAULT_OPTIONS, winsorise: false });
    expect(out3.map((r) => r.x.leverage)).toEqual([expect.closeTo(5 / 7, 9), 0, 0, 1]);
    expect(out3[1].flags).toContain("leverage-negative-ebitda");
    expect(out3[1].flags).not.toContain("leverage-imputed");
    expect(out3[0].flags).not.toContain("leverage-negative-ebitda");
  });
});

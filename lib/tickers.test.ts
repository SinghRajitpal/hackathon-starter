import { describe, expect, it } from "vitest";

import { groupByLetter, matchTickers, parseRankingView } from "@/lib/tickers";

const companies = [
  { ticker: "MSFT", company_name: "Microsoft" },
  { ticker: "AAPL", company_name: "Apple Inc." },
  { ticker: "A", company_name: "Agilent Technologies" },
  { ticker: "MMM", company_name: "3M" },
  { ticker: "PNR", company_name: "Pentair (applied water)" },
];

const tickers = (items: { ticker: string }[]) => items.map((c) => c.ticker);

describe("matchTickers", () => {
  it("returns nothing for a blank query", () => {
    expect(matchTickers(companies, "   ")).toEqual([]);
  });

  it("puts an exact ticker first, then ticker prefixes, then name matches", () => {
    expect(tickers(matchTickers(companies, "a"))).toEqual(["A", "AAPL", "PNR"]);
  });

  it("ranks a company name starting with the query above a ticker that only contains it", () => {
    const options = [
      { ticker: "INVH", company_name: "Invitation Homes" },
      { ticker: "NVDA", company_name: "Nvidia" },
    ];
    expect(tickers(matchTickers(options, "nvi"))).toEqual(["NVDA", "INVH"]);
  });

  it("matches company names, ignoring case", () => {
    expect(tickers(matchTickers(companies, "MICRO"))).toEqual(["MSFT"]);
  });

  it("caps the number of results", () => {
    expect(matchTickers(companies, "a", 2)).toHaveLength(2);
  });
});

describe("groupByLetter", () => {
  it("groups tickers A to Z by first letter, sorted inside each group", () => {
    expect(groupByLetter(companies).map((g) => [g.letter, tickers(g.items)])).toEqual([
      ["A", ["A", "AAPL"]],
      ["M", ["MMM", "MSFT"]],
      ["P", ["PNR"]],
    ]);
  });
});

describe("parseRankingView", () => {
  it("accepts the three ranking views and rejects anything else", () => {
    expect(parseRankingView("sustainability")).toBe("sustainability");
    expect(parseRankingView("netzero")).toBe("netzero");
    expect(parseRankingView("both")).toBe("both");
    expect(parseRankingView("other")).toBeNull();
    expect(parseRankingView(["both"])).toBeNull();
    expect(parseRankingView(undefined)).toBeNull();
  });
});

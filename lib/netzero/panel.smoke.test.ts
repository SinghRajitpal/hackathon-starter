import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NetZeroRiskPanel } from "@/components/netzero/ticker-risk-panel";
import { syntheticUniverse } from "@/lib/netzero/fixtures";
import type { ScenarioData } from "@/lib/netzero/types";

function buildData(): ScenarioData {
  return {
    companies: syntheticUniverse(),
    macRows: [],
    productMap: [],
    segments: [],
    validation: [],
    error: null,
  };
}

describe("NetZeroRiskPanel SSR smoke test", () => {
  const data = buildData();

  it.each(data.companies.map((c) => c.ticker))("renders %s without throwing", (ticker) => {
    const markup = renderToStaticMarkup(createElement(NetZeroRiskPanel, { ticker, data }));
    expect(markup).toContain("Net-zero scenario score");
    expect(markup).toContain("Transition burden");
    expect(markup).toContain("Sector context");
    expect(markup).toContain("Long/short book:");
    expect(markup).toContain("Long-only tilt:");
  });

  it("shows ENE1's TBR-fallback flag (engine flags, not just company.flags)", () => {
    const markup = renderToStaticMarkup(createElement(NetZeroRiskPanel, { ticker: "ENE1", data }));
    expect(markup).toContain("tbr-imputed-no-emissions");
  });

  it("shows a friendly message for a ticker outside the universe", () => {
    const markup = renderToStaticMarkup(createElement(NetZeroRiskPanel, { ticker: "NOPE", data }));
    expect(markup).toContain("is not in the net-zero scenario universe");
  });

  it("shows the DE/BEN not-yet-classified banner when the selected company is unclassified (finding 2)", () => {
    const ticker = data.companies[0].ticker;
    const unclassified: ScenarioData = {
      ...data,
      companies: data.companies.map((c) => (c.ticker === ticker ? { ...c, deBenStatus: "unclassified" } : c)),
    };
    const markup = renderToStaticMarkup(createElement(NetZeroRiskPanel, { ticker, data: unclassified }));
    expect(markup).toContain("not yet classified");
  });

  it("does not show the banner when the selected company is classified", () => {
    const ticker = data.companies[0].ticker;
    const markup = renderToStaticMarkup(createElement(NetZeroRiskPanel, { ticker, data }));
    expect(markup).not.toContain("not yet classified");
  });
});

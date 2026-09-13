import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MethodTab } from "@/features/netzero/components/portfolio/method-tab";
import { syntheticUniverse } from "@/features/netzero/engine/fixtures";
import { buildPortfolioView, DEFAULT_CONTROLS } from "@/features/netzero/engine/portfolio";
import type { ScenarioData } from "@/features/netzero/engine/types";

/**
 * Finding 3: the fallback MAC values are the confirmed mid-points from
 * data/pipeline/nz/maps/mac_costs.csv (scope2 20 / fugitive 20), not the old
 * PDF §12 placeholders (scope2 30 / fugitive 15) — the UI label must say so.
 */
function dataWithNoMacRows(): ScenarioData {
  return { companies: syntheticUniverse(), macRows: [], productMap: [], segments: [], validation: [], error: null };
}

describe("MAC fallback label (finding 3)", () => {
  it("labels the fallback on the method tab's cost table and warning as confirmed mid-points", () => {
    const data = dataWithNoMacRows();
    const view = buildPortfolioView(data, DEFAULT_CONTROLS);
    const markup = renderToStaticMarkup(createElement(MethodTab, { data, view }));
    expect(markup).toContain("confirmed mid-points (maps/mac_costs.csv)");
    expect(markup).not.toContain("PDF §12 mid-point");
  });
});

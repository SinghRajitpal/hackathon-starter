import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Bar } from "@/components/netzero/bar";

describe("Bar", () => {
  it("renders a width the browser serialises identically (no hydration mismatch)", () => {
    const markup = renderToStaticMarkup(
      createElement(Bar, { label: "burden", value: 0.008660940825541918, max: 1, text: "0.9%" }),
    );
    expect(markup).toContain("width:0.87%");
  });
});

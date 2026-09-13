import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPercent } from "@/lib/netzero/format";
import { coverageCounts, type PortfolioView } from "@/lib/netzero/portfolio";
import { CATEGORIES, CATEGORY_LABEL, VARIABLE_LABEL, type ScenarioData } from "@/lib/netzero/types";

const DEFENCE: [string, string][] = [
  [
    "Why not just increase the weight on the environmental variables?",
    "There is no principled number to raise it to. The scenario changes what matters, so the tool changes the variables, not the weights, and the weights come from the data by the same entropy rule.",
  ],
  [
    "You assume dirty companies can raise prices.",
    "No. The model only assumes that the company with the smallest burden relative to earnings has the largest relative advantage. That holds whether the sector passes costs through (the advantage is margin) or absorbs them (the advantage is market share).",
  ],
  [
    "Your Scope 3 is crude.",
    "It is a revenue-share proxy from segment data and is labelled as such. Without it an oil major with clean refineries would look safe; a crude correction of an obvious error beats a precise model of the wrong thing.",
  ],
  [
    "Where do the abatement costs come from, and what if they are wrong?",
    "From published cost curves, shown below with source and date. The book is rebuilt under ±50% costs; positions that survive are marked and positions that flip are halved.",
  ],
  [
    "Isn't this already priced in?",
    "The scenario is a surprise commitment announced tomorrow, so by construction it is not. The tool ranks relative position and does not forecast the size of the price move.",
  ],
  [
    "A billion-dollar fund that shorts is a hedge fund.",
    "Agreed, which is why the default answer is the long-only sector-neutral tilt; the long/short book is the expression a hedge fund would use. Both use the same scores.",
  ],
  [
    "Why not exclude the biggest emitters, like everyone else?",
    "Exclusion is a sector bet in disguise and removes exactly the companies where within-sector selection pays. The long-only tab shows the exclusion portfolio's sector weights next to the tilt.",
  ],
];

const LIMITATIONS = [
  "Abatement costs are sector-agnostic averages per source category, not company-specific engineering estimates.",
  "Demand exposure and beneficiary share depend on segment disclosure and a hand-built mapping table; companies that bundle segments are misclassified in both directions.",
  "The model has no notion of timing: a company that has already funded its transition and one that has only announced it are not separated.",
  "Shorting assumes universal borrow at zero cost.",
  "Beneficiary companies may already trade at valuations that reflect the opportunity; the tool does not look at price.",
  "Second-order effects (suppliers of the losers, customers of the winners) are not modelled.",
  "Data: EPA GHGRP covers US facilities only; non-US emissions come from Climate TRACE with equal splits between owners; missing values are imputed from sector medians and flagged. See docs/decisions-log.md.",
];

export function MethodTab({ data, view }: { data: ScenarioData; view: PortfolioView }) {
  const coverage = coverageCounts(data, view.result.scores);
  const exposed = data.productMap.filter((p) => p.list === "exposed");
  const beneficiary = data.productMap.filter((p) => p.list === "beneficiary");
  const allUnclassified = coverage.companies > 0 && coverage.deBenStatus.unclassified === coverage.companies;

  return (
    <div className="flex flex-col gap-8 text-sm">
      {allUnclassified && (
        <div role="status" className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
          DE/BEN not yet classified (P4 not loaded): every company is currently unclassified, so demand exposure and
          beneficiary share count as zero for all of them until segment classification is loaded.
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Abatement costs (USD per tonne, PDF §4)</h3>
        {view.macMissing.length > 0 && (
          <p className="text-amber-600">
            Missing from the cost table: {view.macMissing.join(", ")}. Confirmed mid-points (maps/mac_costs.csv) are used.
          </p>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source category</TableHead>
                <TableHead className="text-right">Low</TableHead>
                <TableHead className="text-right">Mid</TableHead>
                <TableHead className="text-right">High</TableHead>
                <TableHead className="text-right">In use</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CATEGORIES.map((category) => {
                const row = data.macRows.find((r) => r.category === category);
                return (
                  <TableRow key={category}>
                    <TableCell>{CATEGORY_LABEL[category]}</TableCell>
                    <TableCell className="text-right tabular-nums">{row ? row.low : "n/a"}</TableCell>
                    <TableCell className="text-right tabular-nums">{row ? row.mid : "n/a"}</TableCell>
                    <TableCell className="text-right tabular-nums">{row ? row.high : "n/a"}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{view.config.mac[category]}</TableCell>
                    <TableCell className="text-xs">{row?.source ?? "confirmed mid-points (maps/mac_costs.csv)"}</TableCell>
                    <TableCell className="text-xs">{row?.sourceDate ?? "n/a"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">Negative costs are floored at zero so the bill cannot go negative.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {[
          { title: "Exposed product lines (demand falls → DE)", rows: exposed },
          { title: "Beneficiary product lines (demand rises → BEN)", rows: beneficiary },
        ].map(({ title, rows }) => (
          <div key={title} className="flex flex-col gap-1">
            <h3 className="font-semibold">{title}</h3>
            {rows.length === 0 ? (
              <p className="text-muted-foreground">Mapping table not loaded yet.</p>
            ) : (
              <ul className="list-disc pl-5">
                {rows.map((r) => (
                  <li key={r.productLine}>
                    {r.productLine} <span className="text-xs text-muted-foreground">({r.source})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Entropy weights per sector (PDF §7)</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sector</TableHead>
                {view.config.options.variables.map((v) => (
                  <TableHead key={v} className="text-right">
                    {VARIABLE_LABEL[v]}
                  </TableHead>
                ))}
                <TableHead>Cap events</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.result.sectors.map((s) => (
                <TableRow key={s.sector}>
                  <TableCell className="font-medium">{s.sector}</TableCell>
                  {s.weights.map((w, j) => (
                    <TableCell key={s.variables[j]} className="text-right tabular-nums">
                      {formatPercent(w)}
                    </TableCell>
                  ))}
                  <TableCell className="text-xs">{s.weightEvents.join("; ") || "none"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Book limits (PDF §10)</h3>
        <p>
          Long/short limits (name ≤ 3%, sector ≤ 20%) are measured against the 200% target gross; when fewer sectors
          are tradeable the book holds cash and actual gross is lower.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Coverage</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          <dt className="text-muted-foreground">Companies</dt>
          <dd>{coverage.companies}</dd>
          <dt className="text-muted-foreground">With emissions data</dt>
          <dd>{coverage.withEmissions}</dd>
          <dt className="text-muted-foreground">No emissions (sector-median TBR)</dt>
          <dd>{coverage.noEmissions}</dd>
          <dt className="text-muted-foreground">Missing EBITDA</dt>
          <dd>{coverage.missingEbitda}</dd>
          <dt className="text-muted-foreground">Missing float cap</dt>
          <dd>{coverage.missingFloatCap}</dd>
          <dt className="text-muted-foreground">DE/BEN tagged / note / imputed / unclassified</dt>
          <dd>
            {coverage.deBenStatus.tagged} / {coverage.deBenStatus.note} / {coverage.deBenStatus.imputed} /{" "}
            {coverage.deBenStatus.unclassified}
          </dd>
        </dl>
        {coverage.flags.length > 0 && (
          <ul className="list-disc pl-5 text-xs text-muted-foreground">
            {coverage.flags.map(([flag, count]) => (
              <li key={flag}>
                {flag}: {count}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold">Defending the method (PDF §13)</h3>
        <dl className="flex flex-col gap-3">
          {DEFENCE.map(([question, answer]) => (
            <div key={question}>
              <dt className="font-medium">{question}</dt>
              <dd className="text-muted-foreground">{answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">Known limitations (PDF §14)</h3>
        <ul className="list-disc pl-5">
          {LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

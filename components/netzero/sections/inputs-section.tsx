import { Fragment } from "react";

import { formatPercent, formatTonnes, formatUsd } from "@/lib/netzero/format";
import { CATEGORIES, CATEGORY_LABEL, type CompanyInput } from "@/lib/netzero/types";

export function InputsSection({ company, flags }: { company: CompanyInput; flags: string[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Scenario inputs</h3>
      <p className="text-sm text-muted-foreground">
        {company.sector} · {company.subIndustry}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Revenue (TTM)</dt>
        <dd>{formatUsd(company.revenueTtm)}</dd>
        <dt className="text-muted-foreground">EBITDA (TTM)</dt>
        <dd>{formatUsd(company.ebitdaTtm)}</dd>
        <dt className="text-muted-foreground">Net debt</dt>
        <dd>{formatUsd(company.netDebt)}</dd>
        <dt className="text-muted-foreground">Fossil revenue (DE)</dt>
        <dd>{formatPercent(company.de)}</dd>
        <dt className="text-muted-foreground">Beneficiary revenue (BEN)</dt>
        <dd>{formatPercent(company.ben)}</dd>
        {CATEGORIES.map((category) => (
          <Fragment key={category}>
            <dt className="text-muted-foreground">{CATEGORY_LABEL[category]}</dt>
            <dd>{formatTonnes(company.emissions[category])}</dd>
          </Fragment>
        ))}
      </dl>
      {flags.length > 0 && <p className="text-xs text-muted-foreground">Flags: {flags.join(", ")}</p>}
    </section>
  );
}

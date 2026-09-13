"use client";

import { ScreenHeader } from "@/components/dashboard/frame";
import type { AdjustControls, RiskAnswers, ScreenProps } from "@/lib/netzero/dashboard/types";

export type PortfolioScreenProps = ScreenProps & {
  onAnswers(answers: RiskAnswers): void;
  onAdjust(adjust: AdjustControls): void;
};

/** Placeholder — replaced by the PORTFOLIO task. */
export function PortfolioScreen({ model }: PortfolioScreenProps) {
  return <ScreenHeader title="Portfolio" subtitle={`Preset: ${model.preset.label}`} />;
}

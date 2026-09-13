import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ScopeSection } from "@/components/landing/scope-section";
import { ClosingCta } from "@/components/landing/closing-cta";

export default function LandingPage() {
  return (
    <div
      className="min-h-screen text-white"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 0%, #1b2050 0%, #0b0d22 60%)",
      }}
    >
      <LandingNav />
      <Hero />
      <HowItWorks />
      <ScopeSection />
      <ClosingCta />
    </div>
  );
}

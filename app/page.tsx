import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { SustainabilityScoreSection } from "@/components/landing/sustainability-score-section";
import { NetZeroSection } from "@/components/landing/net-zero-section";

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
      <SustainabilityScoreSection />
      <NetZeroSection />
    </div>
  );
}

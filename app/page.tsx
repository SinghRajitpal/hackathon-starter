import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { PhoneNumberForm } from "@/components/phone-number-form";
import { hasEnvVars } from "@/lib/utils";
import { Suspense } from "react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
        <div className="w-full max-w-5xl flex justify-end items-center p-3 px-5 text-sm">
          {!hasEnvVars ? (
            <EnvVarWarning />
          ) : (
            <Suspense>
              <AuthButton />
            </Suspense>
          )}
        </div>
      </nav>
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="flex flex-col items-center">
          <h1 className="text-5xl font-semibold">hello</h1>
          <p className="text-lg text-foreground/70 mt-2">rajit</p>
        </div>
        <PhoneNumberForm />
      </div>
    </main>
  );
}

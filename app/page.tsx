import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { FavoriteAnimalForm } from "@/components/favorite-animal-form";
import { PhoneNumberForm } from "@/components/phone-number-form";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { Suspense } from "react";

async function FavoriteAnimalSection() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return null;
  }

  const { data } = await supabase
    .from("favorite_animals")
    .select("animal")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  return <FavoriteAnimalForm initialAnimal={data?.animal ?? null} />;
}

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
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <h1 className="text-7xl font-black text-red-600">add caveman!</h1>
        <p className="text-lg text-foreground/70">rajit</p>
        <p className="text-lg text-foreground/70">Henri</p>
        <Suspense>
          <FavoriteAnimalSection />
        </Suspense>
        <PhoneNumberForm />
      </div>
    </main>
  );
}

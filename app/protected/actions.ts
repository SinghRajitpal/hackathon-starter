"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function saveFavoriteAnimal(_prevState: unknown, formData: FormData) {
  const animal = formData.get("animal");

  if (typeof animal !== "string" || animal.trim().length === 0) {
    return { error: "Enter an animal." };
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return { error: "Unauthorized." };
  }

  const { error } = await supabase
    .from("favorite_animals")
    .upsert({ animal: animal.trim() }, { onConflict: "user_id" });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/protected");
  return { error: null };
}

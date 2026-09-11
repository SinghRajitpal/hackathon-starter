"use client";

import { useActionState } from "react";

import { saveFavoriteAnimal } from "@/app/protected/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FavoriteAnimalForm({
  initialAnimal,
}: {
  initialAnimal: string | null;
}) {
  const [state, action, pending] = useActionState(saveFavoriteAnimal, {
    error: null,
  });

  return (
    <form action={action} className="flex flex-col gap-2 items-start w-full max-w-sm">
      <Label htmlFor="animal">Favorite animal</Label>
      <div className="flex gap-2 w-full">
        <Input
          id="animal"
          name="animal"
          defaultValue={initialAnimal ?? ""}
          placeholder="e.g. otter"
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
    </form>
  );
}

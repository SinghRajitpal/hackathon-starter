"use client";

import { useActionState } from "react";

import { saveFavouriteColour } from "@/app/protected/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FavouriteColourForm({
  initialColour,
}: {
  initialColour: string | null;
}) {
  const [state, action, pending] = useActionState(saveFavouriteColour, {
    error: null,
  });

  return (
    <form action={action} className="flex flex-col gap-2 items-start w-full max-w-sm">
      <Label htmlFor="colour">Favourite colour</Label>
      <div className="flex gap-2 w-full">
        <Input
          id="colour"
          name="colour"
          defaultValue={initialColour ?? ""}
          placeholder="e.g. teal"
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

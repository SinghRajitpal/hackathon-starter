"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";

export function PhoneNumberForm() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setStatus("saving");
    setError(null);

    const { error } = await supabase.from("phone_numbers").insert({ phone });

    if (error) {
      setError(error.message);
      setStatus("error");
      return;
    }

    setPhone("");
    setStatus("saved");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-full max-w-xs">
      <Label htmlFor="phone">Phone number</Label>
      <div className="flex gap-2">
        <Input
          id="phone"
          type="tel"
          placeholder="+41 XXXXXXXXX"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving..." : "Save"}
        </Button>
      </div>
      {status === "saved" && <p className="text-sm text-green-600">Saved.</p>}
      {status === "error" && (
        <p className="text-sm text-red-500">
          {error?.toLowerCase().includes("row-level security") ? (
            <>
              <Link href="/auth/login" className="underline underline-offset-4">
                Log in
              </Link>{" "}
              to save your phone number.
            </>
          ) : (
            error
          )}
        </p>
      )}
    </form>
  );
}

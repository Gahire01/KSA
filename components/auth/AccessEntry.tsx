"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRightIcon, LoaderIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api/client";

/**
 * "Have an access link or referral code?" on the sign-in page.
 *
 * Team members never have a password. They paste the link the owner sent, or type
 * the short code, and are taken straight in. A pasted link is handed to
 * /access/[token], which redeems it; a code is redeemed here.
 */

/** Pulls the token out of a pasted link, or accepts a bare token. */
function tokenFrom(input: string): string | null {
  const match = /\/access\/([A-Za-z0-9_-]{20,200})/.exec(input);
  if (match) return match[1];
  const bare = input.trim();
  return /^[A-Za-z0-9_-]{32,200}$/.test(bare) ? bare : null;
}

export function AccessEntry() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const raw = value.trim();
    if (!raw) return;

    const token = tokenFrom(raw);
    if (token) {
      router.push(`/access/${token}`);
      return;
    }

    setBusy(true);
    try {
      await api.post("/referral-codes/redeem", { code: raw });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We could not use that code. Check it and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 border-t border-line pt-4">
      <label htmlFor="access-entry" className="text-xs font-medium text-ink-2">
        Have an access link or referral code?
      </label>
      <div className="flex gap-2">
        <Input
          id="access-entry"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste your link or type your code"
          autoComplete="off"
          spellCheck={false}
          maxLength={400}
        />
        <Button type="submit" variant="outline" disabled={busy || !value.trim()} aria-label="Continue">
          {busy ? <LoaderIcon className="size-4 animate-spin" /> : <ArrowRightIcon className="size-4" />}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-red">
          {error}
        </p>
      ) : null}
    </form>
  );
}

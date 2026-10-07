"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderIcon, ShieldAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api/client";

/**
 * /access/[token] — open the dashboard from a link the owner sent you.
 *
 * There is nothing to fill in: team members have no password, the link is the
 * credential. The page redeems it once on load and goes to the dashboard.
 *
 * The token is sent in a POST body, not re-fetched as a GET on the URL: a credential
 * in a query string ends up in Referer headers and proxy logs. Failures are explained
 * in plain words and say what to do next, without saying anything that would help
 * someone probe for live links.
 */

type Failure = { title: string; body: string };

function explain(error: unknown): Failure {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return { title: "This link can't be used on another device", body: error.message };
    }
    if (error.status === 429) {
      return { title: "Too many attempts", body: "Please wait a few minutes and try again." };
    }
    if (error.status === 410 || error.status === 422) {
      return {
        title: "This link no longer works",
        body: "It may have expired, been used already, or been withdrawn. Ask the academy owner to send you a new one.",
      };
    }
    return { title: "We could not open that link", body: error.message };
  }
  return {
    title: "We could not open that link",
    body: "Check your connection and try again. If it keeps failing, ask the academy owner for a new link.",
  };
}

export default function RedeemAccessLinkPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();

  const [failure, setFailure] = React.useState<Failure | null>(null);
  /* React strict mode runs effects twice in development; a link must be redeemed once. */
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (token.length < 20) {
      setFailure({
        title: "This link is incomplete",
        body: "Ask the academy owner to send it again. Make sure you copied the whole address.",
      });
      return;
    }

    api
      .post<{ nextStep: string }>("/access-links/redeem", { token })
      .then(async () => {
        /* Hydrate the store with the new session before routing, so the app shell
         * does not bounce on a stale `user: null`. */
        await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        router.replace("/dashboard");
        router.refresh();
      })
      .catch((error: unknown) => setFailure(explain(error)));
  }, [token, router, queryClient]);

  if (!failure) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <LoaderIcon className="size-6 animate-spin text-ink-2" />
          <p className="text-sm text-ink-2">Opening your dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-red-bg text-red" aria-hidden>
          <ShieldAlertIcon className="size-6" />
        </span>
        <CardTitle className="text-lg">{failure.title}</CardTitle>
        <CardDescription>{failure.body}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button asChild variant="outline">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { KeyRoundIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * /access/[token] — redeem an invitation.
 *
 * The token arrives as a path segment because that is how the owner shares it (it is
 * what `mintAccessLink` produces and what gets pasted into a message). It is sent to
 * the server in a POST **body** from here, not re-fetched as a GET on the URL: a
 * credential in a query string ends up in `Referer` headers and proxy logs, and this
 * one creates an account.
 *
 * Redeeming mints a complete session and drops the visitor straight into the app —
 * there is no second factor to enrol anymore (sign-in is email OTP from /login).
 */

const schema = z.object({
  fullName: z.string().min(2, "Enter your full name.").max(120),
  email: z
    .string()
    .min(1, "Enter your email address.")
    .email("That does not look like an email address."),
  password: z
    .string()
    .min(12, "Use at least 12 characters.")
    .max(200, "That password is too long."),
});

type Values = z.infer<typeof schema>;

export default function RedeemAccessLinkPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "" },
    mode: "onSubmit",
  });

  const onSubmit = (values: Values) => {
    setServerError(null);

    api
      .post<{ nextStep: string; activeDevices: number }>("/access-links/redeem", {
        token,
        ...values,
      })
      .then(async () => {
        /* Hydrate the store with the new session before routing, so the app
         * shell does not bounce on a stale `user: null`. */
        await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        router.replace("/dashboard");
        router.refresh();
      })
      .catch((error: unknown) => {
        setServerError(
          error instanceof ApiError
            ? error.message
            : "This invitation could not be redeemed. Try again.",
        );
      });
  };

  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle className="text-lg">Accept your invitation</CardTitle>
        <CardDescription>
          Set your details to activate your Kigali Safety Academy account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <ShieldCheckIcon />
          <AlertDescription>
            Accepting activates your account and signs you in — your courses,
            exams and certificates are waiting on the dashboard.
          </AlertDescription>
        </Alert>

        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full gap-1.5"
              disabled={form.formState.isSubmitting || token.length < 20}
            >
              <KeyRoundIcon className="size-4" />
              Activate my account
            </Button>
          </form>
        </Form>

        {token.length < 20 ? (
          <p className="text-xs text-red">
            This invitation link is incomplete. Ask the academy owner to resend it.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

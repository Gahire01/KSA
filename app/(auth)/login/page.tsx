"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon, InfoIcon, KeyRoundIcon } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiError } from "@/lib/api/client";
import { useLogin } from "@/lib/api/hooks";

const schema = z.object({
  email: z
    .string()
    .min(1, "Enter your work email.")
    .email("That does not look like an email address."),
  password: z.string().min(1, "Enter your password."),
});

type Values = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const submitting = login.isPending;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  const onSubmit = (values: Values) => {
    login.mutate(values, {
      onSuccess: (result) => {
        /* First sign-in has to enrol an authenticator before anything else. */
        router.replace(result.nextStep === "mfa-setup" ? "/login/mfa/setup" : "/login/mfa");
      },
      onError: (error) => {
        const message =
          error instanceof ApiError ? error.message : "Could not sign in. Try again.";

        form.setError("password", { message });
        toast.error("Sign-in failed", { description: message });
      },
    });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Sign in
        </h1>
        <p className="text-sm text-ink-2">
          Staff access for owners and administrators.
        </p>
      </header>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Academy account</CardTitle>
          <CardDescription>
            Sign in with your email and password, then confirm with your
            authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="you@academy.rw"
                        aria-invalid={Boolean(form.formState.errors.email)}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage>{form.formState.errors.email?.message}</FormMessage>
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
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••••"
                        aria-invalid={Boolean(form.formState.errors.password)}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage>{form.formState.errors.password?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full gap-1.5"
                disabled={submitting || form.formState.isSubmitting}
              >
                {submitting ? "Signing in…" : "Continue"}
                <ArrowRightIcon className="size-4" />
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Alert>
        <InfoIcon className="size-4" />
        <AlertDescription>
          <p className="font-medium text-ink">Owner account</p>
          <p className="mt-1 text-xs">
            Phase 1 ships a single seeded owner. Sign in with the credentials from{" "}
            <span className="font-mono">SEED_OWNER_PASSWORD</span>, then enrol an
            authenticator app on first use.
          </p>
        </AlertDescription>
      </Alert>

      <p className="text-center text-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <KeyRoundIcon className="size-3" />
          Protected by two-factor authentication
        </span>
        {" · "}
        <Link href="/verify" className="font-medium text-orange-d underline underline-offset-2">
          Public verification
        </Link>
      </p>
    </div>
  );
}

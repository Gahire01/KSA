"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRightIcon, InfoIcon, MailIcon } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuthStore } from "@/lib/stores/auth-store";

const schema = z.object({
  email: z
    .string()
    .min(1, "Enter your work email.")
    .email("That does not look like an email address."),
});

type Values = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  {
    email: "owner@academy.rw",
    name: "Aline Mukamana",
    role: "Owner — full access",
  },
  {
    email: "admin@academy.rw",
    name: "Academy Administrator",
    role: "Administrator",
  },
  {
    email: "trainer@academy.rw",
    name: "Eric Mugisha",
    role: "Trainer — scoped access",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const mfaVerifiedFor = useAuthStore((s) => s.mfaVerifiedFor);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
    mode: "onSubmit",
  });

  /* Returning from MFA with a verified session goes straight in. */
  React.useEffect(() => {
    if (mfaVerifiedFor) router.replace("/dashboard");
  }, [mfaVerifiedFor, router]);

  const onSubmit = (values: Values) => {
    const user = login(values.email);
    toast.success("Check your inbox", {
      description: `We sent a 6-digit code to ${values.email}.`,
    });
    void user;
    router.push("/login/mfa");
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Sign in
        </h1>
        <p className="text-sm text-ink-2">
          Use your academy work email. We&rsquo;ll send a one-time code.
        </p>
      </header>

      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-base">Staff access</CardTitle>
          <CardDescription>
            Passwordless sign-in for owners, administrators and trainers.
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
              <Button type="submit" className="w-full gap-1.5" disabled={form.formState.isSubmitting}>
                Send sign-in code
                <ArrowRightIcon className="size-4" />
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Alert>
        <InfoIcon className="size-4" />
        <AlertDescription>
          <p className="font-medium text-ink">Demo accounts</p>
          <ul className="mt-2 space-y-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => form.setValue("email", account.email, { shouldValidate: true })}
                  className="inline-flex items-center gap-1.5 rounded font-mono text-xs text-navy underline decoration-line underline-offset-2 transition-colors hover:decoration-orange focus-visible:ring-2 focus-visible:ring-orange focus-visible:outline-none"
                >
                  <MailIcon className="size-3" />
                  {account.email}
                </button>
                <span className="shrink-0 text-xs text-ink-2">{account.role}</span>
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>

      <p className="text-center text-xs text-ink-3">
        Need to check a certificate instead?{" "}
        <Link href="/verify" className="font-medium text-orange-d underline underline-offset-2">
          Public verification
        </Link>
      </p>
    </div>
  );
}

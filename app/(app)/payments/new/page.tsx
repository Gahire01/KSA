"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreditCardIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { AvatarInitials } from "@/components/shared/AvatarInitials";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { formatRwf } from "@/lib/utils/format";

type Method = "CASH" | "MOMO" | "BANK" | "CARD";

const METHODS: { value: Method; label: string; hint: string }[] = [
  { value: "MOMO", label: "Mobile money", hint: "MTN MoMo / Airtel Money" },
  { value: "BANK", label: "Bank transfer", hint: "Bank deposit or transfer" },
  { value: "CASH", label: "Cash", hint: "Recorded at the front desk" },
  { value: "CARD", label: "Card", hint: "Visa / Mastercard" },
];

interface TraineeOption {
  id: string;
  fullName: string;
  traineeNo: string;
  email: string;
  amountPaidRwf: number;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
  course: { id: string; name: string; priceRwf: number } | null;
}

const STATUS_LABEL = { PAID: "Paid", PARTIAL: "Part paid", UNPAID: "Unpaid" } as const;

const schema = z.object({
  traineeId: z.string().min(1, "Select a trainee"),
  /* The field starts empty; an empty value is not a payment. */
  amountRwf: z.coerce
    .number({ message: "Enter an amount" })
    .int("Use whole Rwandan francs")
    .positive("Enter an amount above zero"),
  method: z.enum(["CASH", "MOMO", "BANK", "CARD"]),
  reference: z.string().max(120, "Reference is too long").optional(),
  notes: z.string().max(1000, "Notes are too long").optional(),
});

type FormValues = z.input<typeof schema>;

export default function RecordPaymentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const debounced = useDebounce(search, 250);
  const [chosen, setChosen] = React.useState<TraineeOption | null>(null);

  const matches = useQuery({
    queryKey: ["trainees", "payment-picker", debounced],
    queryFn: async () => {
      const page = await api.get<{ items: TraineeOption[] }>("/trainees", {
        search: debounced || undefined,
        pageSize: 30,
      });
      return page.items;
    },
    staleTime: 15_000,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { traineeId: "", amountRwf: "" as unknown as number, method: "MOMO", reference: "", notes: "" },
  });
  const method = watch("method");

  const choose = React.useCallback(
    (t: TraineeOption) => {
      setChosen(t);
      setValue("traineeId", t.id, { shouldValidate: true });
      /* Offer what is still owed; the field stays editable. */
      const owed = Math.max(0, (t.course?.priceRwf ?? 0) - t.amountPaidRwf);
      setValue("amountRwf", (owed > 0 ? String(owed) : "") as unknown as number);
    },
    [setValue],
  );

  /* /payments/new?traineeId= (from a trainee page) opens with that trainee chosen. */
  React.useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("traineeId");
    if (!preset) return;
    void api
      .get<TraineeOption>(`/trainees/${encodeURIComponent(preset)}`)
      .then(choose)
      .catch(() => undefined);
  }, [choose]);

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<{ id: string; receiptNo: string }>("/payments", {
        traineeId: values.traineeId,
        amountRwf: Number(values.amountRwf),
        method: values.method,
        reference: values.reference?.trim() || null,
        notes: values.notes?.trim() || null,
      }),
    onSuccess: (payment) => {
      toast.success(`Payment recorded · ${payment.receiptNo}`, {
        description: "The trainee balance and the register are up to date.",
      });
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      void queryClient.invalidateQueries({ queryKey: ["trainees"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      router.push(`/payments/${payment.id}`);
    },
    onError: (error: Error) => toast.error(error.message || "The payment could not be recorded."),
  });

  const owed = chosen ? Math.max(0, (chosen.course?.priceRwf ?? 0) - chosen.amountPaidRwf) : 0;
  const amount = Number(watch("amountRwf") || 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        breadcrumbSlot={
          <Link href="/payments" className="text-sm text-ink-2 transition-colors hover:text-ink">
            ← Payments
          </Link>
        }
        title="Record a payment"
        subtitle="Payments post to the register immediately and update the trainee balance."
      />

      <form
        onSubmit={handleSubmit((v) => createMutation.mutate(v))}
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]"
      >
        <div className="space-y-5">
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Trainee</CardTitle>
              <CardDescription>Search by name, trainee number or email.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
                  aria-hidden
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search trainees…"
                  className="pl-9"
                  aria-label="Search trainees"
                />
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border border-line">
                {(matches.data ?? []).length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-ink-3">
                    {matches.isLoading ? "Loading…" : "No trainees match that search."}
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {(matches.data ?? []).map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => choose(t)}
                          className={
                            chosen?.id === t.id
                              ? "flex w-full items-center gap-3 bg-orange/8 px-3 py-2.5 text-left"
                              : "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-paper"
                          }
                        >
                          <AvatarInitials name={t.fullName} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">{t.fullName}</span>
                            <span className="block truncate font-mono text-xs text-ink-3">
                              {t.traineeNo} · {t.course?.name ?? "No course"}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-xs whitespace-nowrap text-ink-2 tabular">
                              {formatRwf(t.amountPaidRwf)} / {formatRwf(t.course?.priceRwf ?? 0)}
                            </span>
                            <StatusBadge status={t.paymentStatus} size="sm" label={STATUS_LABEL[t.paymentStatus]} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.traineeId ? <p className="text-xs text-red">{errors.traineeId.message}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Amount &amp; method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="amountRwf">Amount (RWF)</Label>
                <AmountInput id="amountRwf" aria-invalid={Boolean(errors.amountRwf)} {...register("amountRwf")} />
                {errors.amountRwf ? <p className="text-xs text-red">{errors.amountRwf.message}</p> : null}
              </div>

              {chosen && owed > 0 ? (
                <p className="rounded-lg bg-paper px-3 py-2 text-sm text-ink-2">
                  Outstanding for this trainee: <span className="font-semibold text-ink tabular">{formatRwf(owed)}</span>
                </p>
              ) : null}

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink">Payment method</legend>
                <RadioGroup
                  value={method}
                  onValueChange={(v) => setValue("method", v as Method)}
                  className="gap-2"
                >
                  {METHODS.map((m) => (
                    <label
                      key={m.value}
                      htmlFor={`method-${m.value}`}
                      className={
                        method === m.value
                          ? "flex cursor-pointer items-center gap-3 rounded-lg border-2 border-orange bg-orange/5 px-3 py-2"
                          : "flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2 transition-colors hover:bg-paper"
                      }
                    >
                      <RadioGroupItem value={m.value} id={`method-${m.value}`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">{m.label}</span>
                        <span className="block text-xs text-ink-3">{m.hint}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>

              <div className="space-y-1.5">
                <Label htmlFor="reference">Reference (optional)</Label>
                <Input id="reference" placeholder="Mobile money or transaction reference" {...register("reference")} />
                {errors.reference ? <p className="text-xs text-red">{errors.reference.message}</p> : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea id="notes" rows={2} placeholder="Anything the front desk should know." {...register("notes")} />
                {errors.notes ? <p className="text-xs text-red">{errors.notes.message}</p> : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="lg:sticky lg:top-20">
            <CardHeader className="gap-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCardIcon className="size-4 text-ink-2" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="space-y-2 text-sm">
                <SummaryRow label="Trainee" value={chosen?.fullName ?? "—"} />
                <SummaryRow label="Trainee no." value={chosen?.traineeNo ?? "—"} mono />
                <SummaryRow label="Course" value={chosen?.course?.name ?? "—"} />
                <SummaryRow label="Course fee" value={chosen?.course ? formatRwf(chosen.course.priceRwf) : "—"} />
                <SummaryRow label="Method" value={METHODS.find((m) => m.value === method)?.label ?? "—"} />
                <SummaryRow label="Amount" value={formatRwf(amount)} strong />
              </dl>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Recording…" : "Record payment"}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => router.push("/payments")}>
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  mono = false,
  strong = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd
        className={
          strong
            ? "font-display text-lg font-semibold text-ink tabular"
            : mono
              ? "min-w-0 truncate font-mono text-xs text-ink"
              : "min-w-0 truncate text-right text-sm font-medium text-ink"
        }
      >
        {value}
      </dd>
    </div>
  );
}

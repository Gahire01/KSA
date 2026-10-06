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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { mockApi } from "@/lib/mock";
import { formatRwf } from "@/lib/utils/format";
import type { PaymentMethod } from "@/lib/types";

const METHODS: { value: PaymentMethod; label: string; hint: string; prefix: string }[] = [
  { value: "MOMO", label: "Mobile money", hint: "MTN MoMo / Airtel Money", prefix: "MM" },
  { value: "BANK", label: "Bank transfer", hint: "BNI, Equity or I&M", prefix: "BNK" },
  { value: "CASH", label: "Cash", hint: "Recorded at the front desk", prefix: "CSH" },
  { value: "CARD", label: "Card", hint: "Visa / Mastercard", prefix: "CRD" },
];

const schema = z.object({
  traineeId: z.string().min(1, "Select a trainee"),
  courseId: z.string().min(1, "Select a course"),
  amountRwf: z.coerce
    .number({ message: "Enter an amount" })
    .int("Use whole Rwandan francs")
    .positive("Amount must be greater than zero"),
  method: z.enum(["CASH", "MOMO", "BANK", "CARD"]),
  reference: z.string().max(64, "Reference is too long").optional(),
  notes: z.string().max(280, "Notes are too long").optional(),
});

type FormValues = z.input<typeof schema>;

export default function RecordPaymentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [traineeSearch, setTraineeSearch] = React.useState("");

  const coursesQuery = useQuery({
    queryKey: ["courses", "options"],
    queryFn: () => mockApi.courses.list(),
    staleTime: 5 * 60_000,
  });
  const courses = React.useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const traineesQuery = useQuery({
    queryKey: ["trainees", "payment-picker"],
    queryFn: () => mockApi.trainees.all(),
    staleTime: 30_000,
  });
  const trainees = React.useMemo(() => traineesQuery.data ?? [], [traineesQuery.data]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      traineeId: "",
      courseId: "",
      amountRwf: undefined as unknown as number,
      method: "MOMO",
      reference: "",
      notes: "",
    },
  });

  const traineeId = watch("traineeId");
  const method = watch("method");

  const trainee = trainees.find((t) => t.id === traineeId);
  const course = courses.find((c) => c.id === watch("courseId"));

  const filteredTrainees = React.useMemo(() => {
    const q = traineeSearch.trim().toLowerCase();
    const list = q
      ? trainees.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.traineeNo.toLowerCase().includes(q) ||
            t.email.toLowerCase().includes(q),
        )
      : trainees;
    return list.slice(0, 40);
  }, [trainees, traineeSearch]);

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      mockApi.payments.create({
        traineeId: values.traineeId,
        courseId: values.courseId,
        amountRwf: Number(values.amountRwf),
        method: values.method,
        reference: values.reference?.trim() ?? "",
        notes: values.notes?.trim() ?? "",
      }),
    onSuccess: (payment) => {
      toast.success(`Payment recorded · ${payment.receiptNo}`, {
        description: "The trainee balance and ledger are up to date.",
      });
      void queryClient.invalidateQueries({ queryKey: ["payments"] });
      void queryClient.invalidateQueries({ queryKey: ["trainees"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      reset();
      router.push(`/payments/${payment.id}`);
    },
    onError: () => toast.error("The payment could not be recorded."),
  });

  const due = trainee ? Math.max(0, trainee.totalDueRwf - trainee.amountPaidRwf) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5">

      <PageHeader
        breadcrumbSlot={
          <Link
            href="/payments"
            className="text-sm text-ink-2 transition-colors hover:text-ink"
          >
            ← Payments
          </Link>
        }
        title="Record a payment"
        subtitle="Payments post to the ledger immediately and update the trainee balance."
      />

      <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
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
                  value={traineeSearch}
                  onChange={(e) => setTraineeSearch(e.target.value)}
                  placeholder="Search trainees…"
                  className="pl-9"
                  aria-label="Search trainees"
                />
              </div>
              <div className="max-h-64 overflow-auto rounded-lg border border-line">
                {filteredTrainees.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-ink-3">
                    No trainees match that search.
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {filteredTrainees.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setValue("traineeId", t.id, { shouldValidate: true });
                            setValue("courseId", t.courseId, { shouldValidate: true });
                            setValue("amountRwf", Math.max(0, t.totalDueRwf - t.amountPaidRwf) || 0, {
                              shouldValidate: true,
                            });
                          }}
                          className={
                            traineeId === t.id
                              ? "flex w-full items-center gap-3 bg-orange/8 px-3 py-2.5 text-left"
                              : "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-paper"
                          }
                        >
                          <AvatarInitials name={t.name} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {t.name}
                            </span>
                            <span className="block truncate font-mono text-xs text-ink-3">
                              {t.traineeNo}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-xs whitespace-nowrap text-ink-2 tabular">
                              {formatRwf(t.amountPaidRwf)} / {formatRwf(t.totalDueRwf)}
                            </span>
                            <StatusBadge
                              status={t.paymentStatus}
                              size="sm"
                              label={
                                t.paymentStatus === "PAID"
                                  ? "Paid"
                                  : t.paymentStatus === "PARTIAL"
                                    ? "Part paid"
                                    : "Unpaid"
                              }
                            />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {errors.traineeId ? (
                <p className="text-xs text-red">{errors.traineeId.message}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Amount &amp; method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="courseId">Course</Label>
                  <Select
                    value={watch("courseId")}
                    onValueChange={(v) => setValue("courseId", v, { shouldValidate: true })}
                  >
                    <SelectTrigger id="courseId" className="w-full">
                      <SelectValue placeholder="Select a course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} — {formatRwf(c.priceRwf)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.courseId ? (
                    <p className="text-xs text-red">{errors.courseId.message}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="amountRwf">Amount (RWF)</Label>
                  <Input
                    id="amountRwf"
                    type="number"
                    inputMode="numeric"
                    step={1000}
                    min={0}
                    {...register("amountRwf")}
                  />
                  {errors.amountRwf ? (
                    <p className="text-xs text-red">{errors.amountRwf.message}</p>
                  ) : null}
                </div>
              </div>

              {trainee && due > 0 ? (
                <p className="rounded-lg bg-paper px-3 py-2 text-sm text-ink-2">
                  Outstanding balance for this trainee:{" "}
                  <span className="font-semibold text-ink tabular">{formatRwf(due)}</span>
                </p>
              ) : null}

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-ink">Payment method</legend>
                <RadioGroup
                  value={method}
                  onValueChange={(v) => setValue("method", v as PaymentMethod)}
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
                <Label htmlFor="reference">
                  Reference{" "}
                  <span className="font-normal text-ink-3">
                    (e.g. {METHODS.find((m) => m.value === method)?.prefix}-… )
                  </span>
                </Label>
                <Input
                  id="reference"
                  placeholder="Mobile money or transaction reference"
                  {...register("reference")}
                />
                {errors.reference ? (
                  <p className="text-xs text-red">{errors.reference.message}</p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  placeholder="Anything the front desk should know."
                  {...register("notes")}
                />
                {errors.notes ? <p className="text-xs text-red">{errors.notes.message}</p> : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="lg:sticky lg:top-20">
            <CardHeader className="gap-1">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCardIcon className="size-4 text-ink-2" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="space-y-2 text-sm">
                <SummaryRow label="Trainee" value={trainee?.name ?? "—"} />
                <SummaryRow label="Trainee no." value={trainee?.traineeNo ?? "—"} mono />
                <SummaryRow label="Course" value={course?.name ?? "—"} />
                <SummaryRow label="Course fee" value={course ? formatRwf(course.priceRwf) : "—"} />
                <SummaryRow label="Method" value={METHODS.find((m) => m.value === method)?.label ?? "—"} />
                <SummaryRow
                  label="Amount"
                  value={formatRwf(Number(watch("amountRwf") || 0))}
                  strong
                />
              </dl>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Recording…" : "Record payment"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => router.push("/payments")}
              >
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

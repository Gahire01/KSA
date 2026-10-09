"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AmountInput } from "@/components/ui/amount-input";
import { MAX_PRICE_TIERS, standardPrice } from "@/lib/courses/pricing";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api/client";
import { toCourseInput } from "@/lib/api/adapters";
import {
  useCategories,
  useCourse,
  useCreateCourse,
  useUpdateCourse,
} from "@/lib/api/hooks";
import { EXAM_DURATION_MIN, MAX_ATTEMPTS, PASS_MARK_PCT } from "@/lib/exams/rules";
import { formatRwf } from "@/lib/utils/format";
import type { Category } from "@/lib/types";

const schema = z.object({
  code: z
    .string()
    .min(2, "Enter a short course code.")
    .max(12, "Keep the code under 12 characters.")
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only."),
  name: z.string().min(4, "Enter a descriptive course name."),
  category: z.string().min(1, "Choose a category."),
  description: z.string().min(20, "Describe the course in at least 20 characters."),
  durationValue: z.coerce.number().int().min(1, "At least 1.").max(365, "Use 365 or fewer."),
  durationUnit: z.enum(["day", "week", "month"]),
  /* Packages. Amounts stay as text so a new row starts empty; they are converted on save. */
  priceTiers: z
    .array(
      z.object({
        label: z.string().trim().min(1, "Name the package.").max(40, "Keep it short."),
        amountRwf: z.string().regex(/^\d{1,9}$/, "Enter an amount."),
      }),
    )
    .min(1, "Add at least one price.")
    .max(MAX_PRICE_TIERS, `At most ${MAX_PRICE_TIERS} packages.`)
    .refine((tiers) => new Set(tiers.map((t) => t.label.trim().toLowerCase())).size === tiers.length, {
      message: "Each package needs a different name.",
    }),
  passMarkPct: z.coerce.number().int().min(1).max(100, "Between 1 and 100."),
  maxAttempts: z.coerce.number().int().min(1).max(10, "Between 1 and 10."),
  examDurationMin: z.coerce.number().int().min(5).max(300),
  /* Trainers are a Phase 2 model, so this stays optional for now. */
  trainerId: z.string(),
  isActive: z.boolean(),
});

type Values = z.infer<typeof schema>;

export function CourseForm({ courseId }: { courseId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(courseId);

  const categoriesQuery = useCategories();
  const categories = categoriesQuery.data ?? [];

  const trainersQuery = useQuery({
    queryKey: ["trainers", "options"],
    queryFn: async () => {
      const page = await api.get<{ items: Array<{ id: string; name: string | null; email: string }> }>(
        "/trainers",
      );
      return page.items.map((t) => ({ id: t.id, name: t.name ?? t.email, email: t.email }));
    },
    staleTime: 5 * 60_000,
  });

  const courseQuery = useCourse(isEdit ? courseId : undefined);
  const createMutation = useCreateCourse();
  const updateMutation = useUpdateCourse();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      code: "",
      name: "",
      category: "",
      description: "",
      durationValue: 1,
      durationUnit: "day",
      priceTiers: [{ label: "Standard", amountRwf: "" }],
      /* The academy's rules: 50% to pass, two attempts. */
      passMarkPct: PASS_MARK_PCT,
      maxAttempts: MAX_ATTEMPTS,
      examDurationMin: EXAM_DURATION_MIN,
      trainerId: "",
      isActive: true,
    },
  });

  /* Hydrate the form once the existing course arrives. */
  const hydrated = React.useRef(false);
  React.useEffect(() => {
    const course = courseQuery.data;
    if (!course || hydrated.current) return;
    hydrated.current = true;
    form.reset({
      code: course.code,
      name: course.name,
      category: course.category,
      description: course.description,
      durationValue: course.durationValue,
      durationUnit: course.durationUnit,
      priceTiers: (course.priceTiers.length > 0
        ? course.priceTiers
        : [{ label: "Standard", amountRwf: course.priceRwf }]
      ).map((t) => ({ label: t.label, amountRwf: t.amountRwf > 0 ? String(t.amountRwf) : "" })),
      passMarkPct: course.passMarkPct,
      maxAttempts: course.maxAttempts,
      examDurationMin: course.examDurationMin,
      trainerId: course.trainerId,
      isActive: course.isActive,
    });
  }, [courseQuery.data, form]);

  const saving = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: Values) => {
    const input = toCourseInput(
      {
        ...values,
        priceTiers: values.priceTiers.map((t) => ({ label: t.label.trim(), amountRwf: Number(t.amountRwf || 0) })),
      },
      categories,
    );
    const onSuccess = (course: { id: string; name: string }) => {
      toast.success(isEdit ? "Course updated" : "Course created", {
        description: course.name,
      });
      router.push(`/courses/${course.id}`);
    };
    const onError = (error: Error) =>
      toast.error("Could not save the course.", {
        description: error instanceof ApiError ? error.message : undefined,
      });

    if (isEdit && courseId) {
      updateMutation.mutate({ id: courseId, input }, { onSuccess, onError });
    } else {
      createMutation.mutate(input, { onSuccess, onError });
    }
  };

  /* Hooks first, early return after: the order of hooks must not depend on the loading state. */
  const tiers = useFieldArray({ control: form.control, name: "priceTiers" });
  const watchedTiers = form.watch("priceTiers");
  const standard = standardPrice(
    watchedTiers.map((t) => ({ label: t.label, amountRwf: Number(t.amountRwf || 0) })),
  );
  const passMark = form.watch("passMarkPct");

  if (isEdit && courseQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        breadcrumbSlot={
          <Link
            href={isEdit ? `/courses/${courseId}` : "/courses"}
            className="text-sm text-ink-2 transition-colors hover:text-ink"
          >
            ← {isEdit ? "Course" : "Courses"}
          </Link>
        }
        title={isEdit ? "Edit course" : "Create a course"}
        subtitle="Course settings drive fees, pass marks and exam deadlines."
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-5"
          noValidate
        >
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Identity</CardTitle>
              <CardDescription>
                The code is used on certificates and CSV imports.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl>
                      <Input placeholder="FSL1" className="font-mono uppercase" {...field} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.code?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Course name</FormLabel>
                    <FormControl>
                      <Input placeholder="Fire Safety Level 1" {...field} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.name?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.name as Category}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage>{form.formState.errors.category?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.description?.message}</FormMessage>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Delivery</CardTitle>
              <CardDescription>Duration, fee and lead trainer.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="durationValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration</FormLabel>
                    <Input
                      type="number"
                      min={1}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormMessage>{form.formState.errors.durationValue?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="durationUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="day">Days</SelectItem>
                        <SelectItem value="week">Weeks</SelectItem>
                        <SelectItem value="month">Months</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage>{form.formState.errors.durationUnit?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <div className="space-y-2 sm:col-span-3">
                <p className="text-sm font-medium text-ink">Prices (RWF)</p>
                <p className="text-xs text-ink-2">
                  One row per package. The package called Standard (or the middle one of three, or the only one) is the
                  price shown on the course list and offered when enrolling.
                </p>
                <ul className="space-y-2">
                  {tiers.fields.map((row, index) => (
                    <li key={row.id} className="flex items-start gap-2">
                      <div className="w-40 shrink-0">
                        <Input
                          aria-label={`Package ${index + 1} name`}
                          placeholder="Package name"
                          {...form.register(`priceTiers.${index}.label`)}
                        />
                        <p className="mt-1 text-xs text-red">{form.formState.errors.priceTiers?.[index]?.label?.message}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <AmountInput
                          aria-label={`Package ${index + 1} amount in RWF`}
                          {...form.register(`priceTiers.${index}.amountRwf`)}
                        />
                        <p className="mt-1 text-xs text-red">
                          {form.formState.errors.priceTiers?.[index]?.amountRwf?.message}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove package ${index + 1}`}
                        disabled={tiers.fields.length === 1}
                        onClick={() => tiers.remove(index)}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={tiers.fields.length >= MAX_PRICE_TIERS}
                    onClick={() => tiers.append({ label: "", amountRwf: "" })}
                  >
                    <PlusIcon className="size-4" />
                    Add a price
                  </Button>
                  <p className="text-xs text-ink-2">Standard price: {formatRwf(standard)}</p>
                </div>
                <p className="text-xs text-red">
                  {(form.formState.errors.priceTiers as { message?: string } | undefined)?.message ??
                    form.formState.errors.priceTiers?.root?.message}
                </p>
              </div>
              <FormField
                control={form.control}
                name="trainerId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>Lead trainer</FormLabel>
                    {/* Radix Select forbids an empty-string item value, so "none" stands
                        in for "unassigned" and is mapped back to "" for the form. */}
                    <Select
                      value={field.value || "none"}
                      onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Assign a trainer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          <SelectItem value="none">Not assigned</SelectItem>
                          {(trainersQuery.data ?? []).map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        A trainer only sees and runs the courses assigned to them. Add trainers from the
                        Team access page.
                      </FormDescription>
                    <FormMessage>{form.formState.errors.trainerId?.message}</FormMessage>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Exam rules</CardTitle>
              <CardDescription>
                A trainee must reach {Number(passMark) || 0}% to pass.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                control={form.control}
                name="passMarkPct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pass mark (%)</FormLabel>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormMessage>{form.formState.errors.passMarkPct?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxAttempts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max attempts</FormLabel>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormMessage>{form.formState.errors.maxAttempts?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="examDurationMin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time limit (min)</FormLabel>
                    <Input
                      type="number"
                      min={5}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormMessage>{form.formState.errors.examDurationMin?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-4">
                    <div className="flex items-start justify-between gap-4 rounded-lg border border-line p-3">
                      <div>
                        <FormLabel>Active</FormLabel>
                        <FormDescription>
                          Inactive courses cannot take new enrolments.
                        </FormDescription>
                      </div>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Course is active"
                      />
                    </div>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href={isEdit ? `/courses/${courseId}` : "/courses"}>
                <ArrowLeftIcon className="size-4" />
                Cancel
              </Link>
            </Button>
            <Button type="submit" className="gap-1.5" disabled={saving}>
              <SaveIcon className="size-4" />
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create course"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

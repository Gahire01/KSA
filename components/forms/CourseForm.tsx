"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { ApiError } from "@/lib/api/client";
import { toCourseInput } from "@/lib/api/adapters";
import {
  useCategories,
  useCourse,
  useCreateCourse,
  useUpdateCourse,
} from "@/lib/api/hooks";
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
  priceRwf: z.coerce.number().int().min(0, "Fee cannot be negative."),
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

  /* Trainer records are Phase 2; the id is persisted on the course as-is. */
  const trainersQuery = useQuery({
    queryKey: ["trainers", "options"],
    queryFn: async () => [] as { id: string; name: string; title: string }[],
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
      priceRwf: 45000,
      passMarkPct: 70,
      maxAttempts: 3,
      examDurationMin: 45,
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
      priceRwf: course.priceRwf,
      passMarkPct: course.passMarkPct,
      maxAttempts: course.maxAttempts,
      examDurationMin: course.examDurationMin,
      trainerId: course.trainerId,
      isActive: course.isActive,
    });
  }, [courseQuery.data, form]);

  const saving = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: Values) => {
    const input = toCourseInput(values, categories);
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

  if (isEdit && courseQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  const price = form.watch("priceRwf");
  const passMark = form.watch("passMarkPct");

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
              <FormField
                control={form.control}
                name="priceRwf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fee (RWF)</FormLabel>
                    <Input
                      type="number"
                      min={0}
                      step={500}
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                    <FormDescription>{formatRwf(Number(price) || 0)} per enrolment.</FormDescription>
                    <FormMessage>{form.formState.errors.priceRwf?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="trainerId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>Lead trainer</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Assign a trainer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          <SelectItem value="">Not assigned</SelectItem>
                          {(trainersQuery.data ?? []).map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name} — {t.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Trainer accounts arrive in Phase 2, so the lead trainer
                        can be left unassigned for now.
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

"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { toTraineeInput } from "@/lib/api/adapters";
import {
  useCategories,
  useCourses,
  useTrainee,
  useUpdateTrainee,
} from "@/lib/api/hooks";
import { COUNTRIES, type Category } from "@/lib/types";

/* Courses for the select dropdown; bounded by the API's MAX_PAGE_SIZE. */
const COURSE_OPTION_LIMIT = 100;

const schema = z.object({
  name: z.string().min(3, "Enter the trainee's full name."),
  email: z.string().email("Enter a valid email address."),
  phone: z
    .string()
    .min(7, "Enter a reachable phone number.")
    .regex(/^\+?\d[\d\s]{6,}$/, "Use digits, spaces and an optional leading +."),
  country: z.string().min(1, "Select a country."),
  category: z.string().min(1, "Select a category."),
  courseId: z.string().min(1, "Select a course."),
  status: z.enum(["PENDING", "ACTIVE", "COMPLETED", "FAILED", "WITHDRAWN"]),
  paymentStatus: z.enum(["PAID", "PARTIAL", "UNPAID"]),
  amountPaidRwf: z.coerce
    .number({ invalid_type_error: "Enter an amount." })
    .min(0, "Amount cannot be negative."),
  notes: z.string().max(500, "Keep notes under 500 characters.").optional(),
});

type Values = z.infer<typeof schema>;

export default function EditTraineePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const { data: trainee, isLoading, isError } = useTrainee(id);
  const categoriesQuery = useCategories();
  const coursesQuery = useCourses({ page: 1, pageSize: COURSE_OPTION_LIMIT });
  const categories = categoriesQuery.data ?? [];
  const courses = React.useMemo(() => coursesQuery.data?.items ?? [], [coursesQuery.data]);
  const updateMutation = useUpdateTrainee();

  const form = useForm<Values>({ resolver: zodResolver(schema) });

  /* Seed the form once the real record arrives. */
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (!trainee || seededRef.current) return;
    seededRef.current = true;

    form.reset({
      name: trainee.name,
      email: trainee.email,
      phone: trainee.phone,
      country: trainee.country,
      category: trainee.category,
      courseId: trainee.courseId || courses[0]?.id || "",
      /* SUSPENDED exists in the UI type but not in the Phase 1 database. */
      status: trainee.status as Values["status"],
      paymentStatus: trainee.paymentStatus,
      amountPaidRwf: trainee.amountPaidRwf,
      notes: trainee.notes,
    });
  }, [trainee, form, courses]);

  const submit = (values: Values) => {
    updateMutation.mutate(
      { id, input: toTraineeInput(values, categories) },
      {
        onSuccess: () => {
          toast.success("Trainee updated", { description: values.name });
          router.push(`/trainees/${id}`);
        },
        onError: (error) =>
          toast.error("Could not save those changes.", {
            description: error instanceof ApiError ? error.message : undefined,
          }),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !trainee) {
    return (
      <EmptyState
        title="Trainee not found"
        description="This record may have been removed, or the link is incorrect."
        action={
          <Button asChild size="sm">
            <Link href="/trainees">Back to trainees</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        breadcrumbSlot={
          <Link
            href={`/trainees/${id}`}
            className="text-sm text-ink-2 transition-colors hover:text-ink"
          >
            ← {trainee.name}
          </Link>
        }
        title="Edit trainee"
        subtitle={`${trainee.traineeNo} · saved to the database`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/trainees/${id}`}>Cancel</Link>
          </Button>
        }
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Personal details</CardTitle>
              <CardDescription>
                The trainee uses these details to receive exam links and receipts.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Clarisse Uwase" {...field} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.name?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="name@example.com" {...field} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.email?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="+250 788 000 000" {...field} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.phone?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage>{form.formState.errors.country?.message}</FormMessage>
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
                          <SelectValue placeholder="Select a category" />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Enrolment</CardTitle>
              <CardDescription>Course, progress and fee state.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="courseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a course" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage>{form.formState.errors.courseId?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enrolment status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(
                          ["PENDING", "ACTIVE", "COMPLETED", "FAILED", "WITHDRAWN"] as const
                        ).map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.charAt(0) + s.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage>{form.formState.errors.status?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(["PAID", "PARTIAL", "UNPAID"] as const).map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.charAt(0) + s.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage>{form.formState.errors.paymentStatus?.message}</FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amountPaidRwf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount paid (RWF)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={500}
                        inputMode="numeric"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? 0 : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Payment records themselves arrive in Phase 2.
                    </FormDescription>
                    <FormMessage>
                      {form.formState.errors.amountPaidRwf?.message}
                    </FormMessage>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Anything staff should know…" {...field} />
                    </FormControl>
                    <FormMessage>{form.formState.errors.notes?.message}</FormMessage>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href={`/trainees/${id}`}>
                <ArrowLeftIcon className="size-4" />
                Cancel
              </Link>
            </Button>
            <Button type="submit" className="gap-1.5" disabled={updateMutation.isPending}>
              <SaveIcon className="size-4" />
              {updateMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
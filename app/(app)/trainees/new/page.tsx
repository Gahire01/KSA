"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiError } from "@/lib/api/client";
import { toTraineeInput } from "@/lib/api/adapters";
import { useCategories, useCourses, useCreateTrainee } from "@/lib/api/hooks";
import { formatRwf } from "@/lib/utils/format";
import { COUNTRIES, type Category } from "@/lib/types";
import { ACADEMY } from "@/lib/academy/constants";

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
  amountPaidRwf: z.coerce
    .number({ invalid_type_error: "Enter an amount." })
    .min(0, "Amount cannot be negative."),
  notes: z.string().max(500, "Keep notes under 500 characters.").optional(),
  consent: z
    .boolean()
    .refine((value) => value === true, "Confirm that the trainee consented to their data being stored."),
});

type Values = z.infer<typeof schema>;

export default function NewTraineePage() {
  const router = useRouter();

  const categoriesQuery = useCategories();
  const coursesQuery = useCourses({ page: 1, pageSize: COURSE_OPTION_LIMIT });
  const categories = categoriesQuery.data ?? [];
  const courses = coursesQuery.data?.items ?? [];

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      country: "Rwanda",
      category: "",
      courseId: "",
      amountPaidRwf: 0,
      notes: "",
      consent: false,
    },
  });

  const courseId = form.watch("courseId");
  const selectedCourse = courses.find((c) => c.id === courseId);
  const price = selectedCourse?.priceRwf ?? 0;
  const amount = form.watch("amountPaidRwf");
  const balance = Math.max(0, price - Number(amount || 0));

  /* Picking a course defaults the amount to the standard fee; the field stays
     editable so a partial payment or a package price can be entered instead. */
  React.useEffect(() => {
    if (selectedCourse) form.setValue("amountPaidRwf", selectedCourse.priceRwf);
  }, [courseId, selectedCourse, form]);

  const createMutation = useCreateTrainee();

  const submit = (values: Values) => {
    createMutation.mutate(toTraineeInput(values, categories), {
      onSuccess: (trainee) => {
        toast.success("Trainee created", {
          description: `${trainee.name} · ${trainee.traineeNo}`,
        });
        router.push(`/trainees/${trainee.id}`);
      },
      onError: (error) =>
        toast.error("Could not create that trainee.", {
          description: error instanceof ApiError ? error.message : undefined,
        }),
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        breadcrumbSlot={
          <Link href="/trainees" className="text-sm text-ink-2 transition-colors hover:text-ink">
            ← Trainees
          </Link>
        }
        title="Add a trainee"
        subtitle="Create a single enrolment record. You can import many at once from CSV."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/trainees/import">Import CSV instead</Link>
          </Button>
        }
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(submit)}
          className="space-y-5"
          noValidate
        >
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
                      <Input placeholder="Full name" {...field} />
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
                      <Input type="email" placeholder="Email address" {...field} />
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
                      <Input type="tel" placeholder="+250 7XX XXX XXX" {...field} />
                    </FormControl>
                    <FormDescription>Used for SMS reminders.</FormDescription>
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
              <CardDescription>
                The course sets the price, pass mark and exam deadline.
              </CardDescription>
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
                            {c.name} — {formatRwf(c.priceRwf)}
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
                      {price > 0
                        ? `Course fee is ${formatRwf(price)} — balance ${formatRwf(balance)}.`
                        : "Course fee will be applied once a course is selected."}
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

          {balance > 0 ? (
            <Alert>
              <AlertDescription>
                This enrolment will be created as <strong>partially paid</strong> with{" "}
                {formatRwf(balance)} outstanding. You can record the rest from the
                trainee&rsquo;s page.
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader className="gap-1">
              <CardTitle className="text-base">Data protection consent</CardTitle>
              <CardDescription>
                Required before a record is created.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="consent"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start gap-2.5">
                      <FormControl>
                        <Checkbox
                          id="trainee-consent"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="mt-0.5"
                        />
                      </FormControl>
                      <label
                        htmlFor="trainee-consent"
                        className="text-sm leading-relaxed text-ink-2"
                      >
                        I confirm the trainee was told that their enrolment data — name, contact
                        details, course progress, exam results and payments — is stored by{" "}
                        {ACADEMY.name} for certification and compliance, and that they can
                        request a copy or deletion of their records.{" "}
                        <Link
                          href="/privacy"
                          className="text-orange-d underline underline-offset-2"
                        >
                          Privacy policy
                        </Link>
                      </label>
                    </div>
                    <FormMessage>{form.formState.errors.consent?.message}</FormMessage>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/trainees">
                <ArrowLeftIcon className="size-4" />
                Cancel
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={form.handleSubmit(submit)}
                disabled={createMutation.isPending}
              >
                Save and add another
              </Button>
              <Button
                type="submit"
                className="gap-1.5"
                disabled={createMutation.isPending}
              >
                <SaveIcon className="size-4" />
                {createMutation.isPending ? "Creating…" : "Create trainee"}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import { toCourse, toCourses, toTrainee, toTrainees } from "@/lib/api/adapters";
import type {
  CategoryDTO,
  CategoryWithCountDTO,
  CourseDTO,
  CourseFilters,
  CourseInput,
  LoginResultDTO,
  LoginResendDTO,
  LoginVerifyDTO,
  MeDTO,
  MfaConfirmDTO,
  MfaSetupDTO,
  MfaVerifyDTO,
  Paginated,
  TraineeDTO,
  TraineeFilters,
  TraineeInput,
} from "@/lib/api/types";

const keys = {
  me: ["auth", "me"] as const,
  categories: ["categories"] as const,
  courses: (filters?: CourseFilters) => ["courses", "list", filters ?? {}] as const,
  course: (id: string) => ["courses", "detail", id] as const,
  trainees: (filters?: TraineeFilters) => ["trainees", "list", filters ?? {}] as const,
  trainee: (id: string) => ["trainees", "detail", id] as const,
};

/* ── Auth ────────────────────────────────────────────────────── */

/**
 * The session behind the current cookie. Returns 200 with `user: null` when
 * signed out, so callers read `data?.user` instead of branching on the status.
 */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api.get<MeDTO>("/auth/me"),
    staleTime: 60_000,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api.post<LoginResultDTO>("/auth/login", input),
    onSuccess: () => {
      /* Nothing is signed in yet — the code screen comes next — but any stale
       * answer from an earlier session is no longer interesting. */
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}

/** Redeems the six-digit emailed code and sets the session cookie. */
export function useLoginVerify() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { email: string; code: string }) =>
      api.post<LoginVerifyDTO>("/auth/login/verify", input),
    onSuccess: () => {
      /* The cookie is now set, so the previous "signed out" answer is stale. */
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}

/** Asks for a fresh code for the same sign-in. */
export function useLoginResend() {
  return useMutation({
    mutationFn: (email: string) => api.post<LoginResendDTO>("/auth/login/resend", { email }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>("/auth/logout"),
    /* Clear regardless: the session is gone server-side either way. */
    onSettled: () => queryClient.clear(),
  });
}

export function useMfaSetup() {
  return useMutation({
    mutationFn: () => api.post<MfaSetupDTO>("/auth/mfa/setup"),
  });
}

export function useMfaConfirm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => api.post<MfaConfirmDTO>("/auth/mfa/confirm", { code }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useMfaVerify() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => api.post<MfaVerifyDTO>("/auth/mfa/verify", { code }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.me });
    },
  });
}

/* ── Categories ──────────────────────────────────────────────── */

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: () => api.get<CategoryWithCountDTO[]>("/categories"),
    staleTime: 5 * 60_000,
  });
}

export function useCategoryOptions(): CategoryDTO[] {
  const { data } = useCategories();
  return data ?? [];
}

/* ── Courses ─────────────────────────────────────────────────── */

export function useCourses(filters?: CourseFilters) {
  return useQuery({
    queryKey: keys.courses(filters),
    queryFn: async () => {
      const page = await api.get<Paginated<CourseDTO>>("/courses", filters as Record<string, unknown>);
      return { ...page, items: toCourses(page.items) };
    },
    staleTime: 30_000,
  });
}

export function useCourse(id?: string) {
  return useQuery({
    queryKey: keys.course(id ?? ""),
    queryFn: async () => toCourse(await api.get<CourseDTO>(`/courses/${id}`)),
    enabled: Boolean(id),
  });
}

function useInvalidateCourses() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["courses"] });
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
  };
}

export function useCreateCourse() {
  const invalidate = useInvalidateCourses();

  return useMutation({
    mutationFn: (input: CourseInput & { trainerId?: string | null }) =>
      api.post<CourseDTO>("/courses", input).then(toCourse),
    onSuccess: invalidate,
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateCourses();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CourseInput> }) =>
      api.patch<CourseDTO>(`/courses/${id}`, input).then(toCourse),
    onSuccess: (course) => {
      queryClient.setQueryData(keys.course(course.id), course);
      invalidate();
    },
  });
}

export function useDeleteCourse() {
  const invalidate = useInvalidateCourses();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/courses/${id}`),
    onSuccess: invalidate,
  });
}

/* ── Trainees ────────────────────────────────────────────────── */

export function useTrainees(filters?: TraineeFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: keys.trainees(filters),
    queryFn: async () => {
      const page = await api.get<Paginated<TraineeDTO>>(
        "/trainees",
        filters as Record<string, unknown>,
      );
      return { ...page, items: toTrainees(page.items) };
    },
    staleTime: 30_000,
    enabled: options?.enabled,
  });
}

export function useTrainee(id?: string) {
  return useQuery({
    queryKey: keys.trainee(id ?? ""),
    queryFn: async () => toTrainee(await api.get<TraineeDTO>(`/trainees/${id}`)),
    enabled: Boolean(id),
  });
}

function useInvalidateTrainees() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["trainees"] });
    void queryClient.invalidateQueries({ queryKey: ["courses"] });
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
  };
}

export function useCreateTrainee() {
  const invalidate = useInvalidateTrainees();

  return useMutation({
    mutationFn: (input: TraineeInput) =>
      api.post<TraineeDTO>("/trainees", input).then(toTrainee),
    onSuccess: invalidate,
  });
}

export function useUpdateTrainee() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTrainees();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TraineeInput> }) =>
      api.patch<TraineeDTO>(`/trainees/${id}`, input).then(toTrainee),
    onSuccess: (trainee) => {
      queryClient.setQueryData(keys.trainee(trainee.id), trainee);
      invalidate();
    },
  });
}

export function useDeleteTrainee() {
  const invalidate = useInvalidateTrainees();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/trainees/${id}`),
    onSuccess: invalidate,
  });
}

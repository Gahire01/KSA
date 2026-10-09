import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";

export const TAGS = {
  categories: "categories",
  courses: "courses",
  courseLists: "courses:list",
} as const;

export async function getCategoriesCached() {
  return unstable_cache(
    async () => {
      const categories = await prisma.category.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { courses: true } } },
      });
      return categories.map((c) => ({
        id: c.id,
        name: c.name,
        courseCount: c._count.courses,
      }));
    },
    ["categories"],
    { revalidate: 60, tags: [TAGS.categories] },
  )();
}

/**
 * The unfiltered course list (what every dropdown and the courses page open with), cached
 * for 60 seconds. Searched, filtered or trainer-scoped requests skip the cache and read
 * the database directly, so nobody sees another trainer's courses. Anything that changes
 * a course or its trainee count calls {@link invalidateCourses}.
 */
export async function getCoursesCached(page: number, pageSize: number) {
  return unstable_cache(
    async () => {
      const [items, total] = await Promise.all([
        prisma.course.findMany({
          orderBy: { createdAt: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            category: { select: { id: true, name: true } },
            _count: { select: { trainees: true } },
          },
        }),
        prisma.course.count(),
      ]);
      return { items, total };
    },
    ["courses", String(page), String(pageSize)],
    { revalidate: 60, tags: [TAGS.courses, TAGS.courseLists] },
  )();
}

export async function invalidateCategories() {
  revalidateTag(TAGS.categories);
}

export async function invalidateCourses() {
  revalidateTag(TAGS.courses);
  revalidateTag(TAGS.courseLists);
}

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

export async function invalidateCategories() {
  revalidateTag(TAGS.categories);
}

export async function invalidateCourses() {
  revalidateTag(TAGS.courses);
  revalidateTag(TAGS.courseLists);
}

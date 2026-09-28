"use client";

import { useParams } from "next/navigation";

import { CourseForm } from "@/components/forms/CourseForm";

export default function EditCoursePage() {
  const params = useParams<{ id: string }>();
  return <CourseForm courseId={params.id} />;
}

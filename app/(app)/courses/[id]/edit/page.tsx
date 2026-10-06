"use client";

import { useParams } from "next/navigation";

import { CourseForm } from "@/components/forms/CourseForm";

export default function EditCoursePage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="space-y-5">

      <CourseForm courseId={params.id} />
    </div>
  );
}

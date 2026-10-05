"use client";

import { useParams } from "next/navigation";

import { CourseForm } from "@/components/forms/CourseForm";
import { DemoBanner } from "@/components/shared/DemoBanner";

export default function EditCoursePage() {
  const params = useParams<{ id: string }>();
  return (
    <div className="space-y-5">
      <DemoBanner>
        The trainer list is still demo data; the rest of this form saves to the
        database.
      </DemoBanner>

      <CourseForm courseId={params.id} />
    </div>
  );
}

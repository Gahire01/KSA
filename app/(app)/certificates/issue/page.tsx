import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { canIssueManualCertificate } from "@/lib/certificates/manual-policy";
import { prisma } from "@/lib/db";
import { ManualCertificateForm } from "@/components/certificate/ManualCertificateForm";

export default async function IssueCertificatePage() {
  const session = await getSession();
  if (!session || !canIssueManualCertificate(session.user) || session.accessLinkId || session.referralCodeId || session.user.lockedAt) notFound();
  const courses = await prisma.course.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } });
  return <ManualCertificateForm courses={courses} />;
}

import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { z } from "zod";

import { guard } from "@/lib/api/guard";
import { apiFail, zodMessage } from "@/lib/api/response";
import { actorOf, audit } from "@/lib/audit";
import { REPORT_META, REPORT_TYPES, buildReport, type ReportType } from "@/lib/reports/build";
import { reportToExcel } from "@/lib/reports/excel";
import { ReportDocument } from "@/lib/reports/pdf";

/**
 * GET /api/reports/:type?format=xlsx|pdf&courseIds=a,b&methods=…&statuses=…&from=…&to=…
 *
 * Streams a branded Excel workbook or PDF. There is no CSV here on purpose. Session
 * gated: staff for the data reports, the owner alone for the audit log. Each download
 * is itself written to the audit trail.
 */

export const dynamic = "force-dynamic";

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined));

const querySchema = z
  .object({
    format: z.enum(["xlsx", "pdf"]),
    courseIds: csv,
    methods: csv,
    statuses: csv,
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict();

export async function GET(request: Request, context: { params: Promise<{ type: string }> }) {
  const { type } = await context.params;
  if (!(REPORT_TYPES as readonly string[]).includes(type)) return apiFail("Unknown report.", 404);
  const reportType = type as ReportType;

  const gate = await guard(REPORT_META[reportType].ownerOnly ? "audit.read" : "report.read");
  if (!gate.ok) return gate.response;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return apiFail(zodMessage(parsed.error), 422);
  const { format, ...filters } = parsed.data;

  const generatedAt = new Date();
  let table;
  try {
    table = await buildReport(reportType, filters);
  } catch (error) {
    return apiFail("The report could not be built.", 500, { logError: error });
  }

  const stamp = generatedAt.toISOString().slice(0, 10);
  const base = `ksa-${reportType}-${stamp}`;

  await audit({
    ...actorOf(gate.session),
    action: "report.generate",
    entityType: "Report",
    entityId: reportType,
    meta: { format, rows: table.rows.length },
  });

  const noStore = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

  if (format === "xlsx") {
    const buffer = await reportToExcel(table, generatedAt);
    return new Response(new Uint8Array(buffer), {
      headers: {
        ...noStore,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      },
    });
  }

  const pdf = await renderToBuffer(React.createElement(ReportDocument, { table, generatedAt }));
  return new Response(new Uint8Array(pdf), {
    headers: {
      ...noStore,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${base}.pdf"`,
    },
  });
}

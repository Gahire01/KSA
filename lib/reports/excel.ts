import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ReportTable } from "@/lib/reports/build";

/**
 * Writes a report as an .xlsx workbook: logo, academy name, report title, the filter
 * summary and the date it was generated, then the table with a frozen, filterable
 * header. Money columns are real numbers (not text) so they sum in Excel.
 */

const NAVY = "FF0F2340";
const ORANGE = "FFE8590C";

export async function reportToExcel(table: ReportTable, generatedAt: Date): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kigali Safety Academy";
  workbook.created = generatedAt;

  const sheet = workbook.addWorksheet(table.title.slice(0, 28), {
    views: [{ state: "frozen", ySplit: 0 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  table.columns.forEach((col, i) => {
    sheet.getColumn(i + 1).width = col.width;
  });

  /* Brand block: logo on the left, name and title beside it. */
  try {
    const logo = readFileSync(join(process.cwd(), "public", "logo.png"));
    const imageId = workbook.addImage({ buffer: logo as unknown as ExcelJS.Buffer, extension: "png" });
    sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 64, height: 64 } });
  } catch {
    /* No logo file in this deployment: the text header still carries the brand. */
  }

  sheet.getRow(1).height = 24;
  sheet.getRow(2).height = 24;
  sheet.getRow(3).height = 20;

  const name = sheet.getCell("C1");
  name.value = "KIGALI SAFETY ACADEMY";
  name.font = { bold: true, size: 14, color: { argb: NAVY } };

  const title = sheet.getCell("C2");
  title.value = table.title;
  title.font = { bold: true, size: 12, color: { argb: ORANGE } };

  const when = sheet.getCell("C3");
  when.value = `Generated ${generatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC · ${table.rows.length} rows`;
  when.font = { size: 9, color: { argb: "FF4B5563" } };

  let rowIndex = 5;
  for (const line of table.filterSummary) {
    const cell = sheet.getCell(`A${rowIndex}`);
    cell.value = line;
    cell.font = { size: 9, italic: true, color: { argb: "FF4B5563" } };
    rowIndex += 1;
  }
  rowIndex += 1;

  const headerRow = sheet.getRow(rowIndex);
  table.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: col.align === "right" ? "right" : "left" };
  });
  headerRow.height = 20;

  for (const values of table.rows) {
    rowIndex += 1;
    const row = sheet.getRow(rowIndex);
    values.forEach((value, i) => {
      const cell = row.getCell(i + 1);
      cell.value = value === "" ? null : value;
      const col = table.columns[i];
      if (typeof value === "number" && /RWF/.test(col?.header ?? "")) cell.numFmt = "#,##0";
      if (col?.align === "right") cell.alignment = { horizontal: "right" };
    });
  }

  const headerAt = 5 + table.filterSummary.length + 1;
  sheet.views = [{ state: "frozen", ySplit: headerAt }];
  sheet.autoFilter = {
    from: { row: headerAt, column: 1 },
    to: { row: headerAt, column: table.columns.length },
  };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

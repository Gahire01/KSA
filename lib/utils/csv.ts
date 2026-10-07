/**
 * CSV output that is safe to open in a spreadsheet.
 *
 * A cell that starts with = + - @ (or a tab or carriage return) is run as a formula
 * by Excel, Sheets and Numbers. Names, notes and reasons in this app are typed by
 * people, so an export would otherwise let one of them run a formula on whoever
 * opens the file. Such a cell is prefixed with a single quote, which makes the
 * spreadsheet show it as plain text; then the usual quoting is applied.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [csvRow(header), ...rows.map(csvRow)].join("\r\n");
}

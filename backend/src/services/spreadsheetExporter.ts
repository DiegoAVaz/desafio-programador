import ExcelJS from 'exceljs';
import {
  CartaoPontoValue,
  HoleriteValue,
  TranscricaoValue,
  TipoTranscricao,
} from '../types/transcricao';

export type FormatoPlanilha = 'xlsx' | 'csv' | 'json';

export interface PlanilhaExportada {
  body: Buffer | string;
  contentType: string;
  filename: string;
}

const HEADER_FILL = 'FF173772';
const WARNING_FILL = 'FFFFF3CD';
const ERROR_FILL = 'FFF8D7DA';
const ERROR_BORDER = 'FFDC3545';

const hasUncertainty = (values: string[]): boolean => values.some((value) => value.includes('?'));

const parseDate = (raw: string): Date | null => {
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? parsed : null;
};

const hasNonSequentialDate = (previous: string | null, current: string): boolean => {
  if (!previous) return false;
  const before = parseDate(previous);
  const now = parseDate(current);
  if (!before || !now) return false;
  const expected = new Date(before);
  expected.setUTCDate(expected.getUTCDate() + 1);
  return expected.getTime() !== now.getTime();
};

const monthIndex = (year: string, month: string): number | null => {
  if (!/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month)) return null;
  return Number(year) * 12 + Number(month) - 1;
};

const escapeCsv = (value: unknown): string => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const csv = (rows: unknown[][]): string => `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`;

const applyHeaderStyle = (worksheet: ExcelJS.Worksheet): void => {
  worksheet.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
  });
};

const applyRowStyle = (worksheet: ExcelJS.Worksheet, rowNumber: number, error: boolean, warning: boolean): void => {
  if (!error && !warning) return;
  const fill = error ? ERROR_FILL : WARNING_FILL;
  worksheet.getRow(rowNumber).eachCell((cell, columnNumber) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    if (error && columnNumber === 1) {
      cell.border = { left: { style: 'thin', color: { argb: ERROR_BORDER } } };
    }
  });
};

const buildTimeCardRows = (value: CartaoPontoValue): { headers: string[]; rows: string[][] } => {
  const days = value.pages.flatMap((page) => page.days);
  const maxPunches = Math.max(0, ...days.map((day) => day.punches.length));
  const headers = ['Data', ...Array.from({ length: maxPunches }, (_, index) =>
    `${index % 2 === 0 ? 'Entrada' : 'Saída'} ${Math.floor(index / 2) + 1}`,
  )];
  return {
    headers,
    rows: days.map((day) => [
      day.date_raw,
      ...day.punches.map((punch) => punch.time_hhmm),
      ...Array.from({ length: maxPunches - day.punches.length }, () => ''),
    ]),
  };
};

const buildPayrollRows = (value: HoleriteValue): { headers: string[]; rows: Array<Array<string | number>> } => {
  const labels: string[] = [];
  value.pages.forEach((page) => page.fields.forEach((field) => {
    if (field.label && !labels.includes(field.label)) labels.push(field.label);
  }));
  const headers = ['Pág.', 'Mês', 'Ano', ...labels];
  const rows = value.pages.map((page) => {
    const fields = new Map(page.fields.map((field) => [field.label, field.value]));
    return [page.page, page.month, page.year, ...labels.map((label) => fields.get(label) ?? '')];
  });
  return { headers, rows };
};

const buildTimeCardWorkbook = (value: CartaoPontoValue): ExcelJS.Workbook => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Cartão de Ponto');
  const { headers, rows } = buildTimeCardRows(value);
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));
  worksheet.columns.forEach((column, index) => { column.width = Math.max(12, (headers[index] ?? '').length + 2); });
  applyHeaderStyle(worksheet);

  let previousDate: string | null = null;
  value.pages.flatMap((page) => page.days).forEach((day, index) => {
    const error = hasNonSequentialDate(previousDate, day.date_raw);
    const warning = day.punches.length % 2 === 1 || hasUncertainty([
      day.date_raw,
      ...day.punches.flatMap((punch) => [punch.time_raw, punch.time_hhmm]),
    ]);
    applyRowStyle(worksheet, index + 2, error, warning);
    if (parseDate(day.date_raw)) previousDate = day.date_raw;
  });
  return workbook;
};

const buildPayrollWorkbook = (value: HoleriteValue): ExcelJS.Workbook => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Holerite');
  const { headers, rows } = buildPayrollRows(value);
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));
  worksheet.columns.forEach((column, index) => { column.width = Math.max(12, (headers[index] ?? '').length + 2); });
  applyHeaderStyle(worksheet);

  let previousCompetence: number | null = null;
  value.pages.forEach((page, index) => {
    const competence = monthIndex(page.year, page.month);
    const error = competence !== null && previousCompetence !== null && competence !== previousCompetence + 1;
    const warning = page.fields.length === 0 || hasUncertainty([
      page.month, page.year,
      ...page.fields.flatMap((field) => [field.code, field.label, field.reference, field.value]),
      ...page.bases.flatMap((base) => [base.label, base.value]),
    ]);
    applyRowStyle(worksheet, index + 2, error, warning);
    if (competence !== null) previousCompetence = competence;
  });
  return workbook;
};

export const exportarPlanilha = async (
  tipo: TipoTranscricao,
  value: TranscricaoValue,
  formato: FormatoPlanilha,
): Promise<PlanilhaExportada> => {
  if (formato === 'json') {
    return { body: JSON.stringify(value, null, 2), contentType: 'application/json; charset=utf-8', filename: 'transcricao.json' };
  }

  const rows = tipo === 'cartao-ponto'
    ? buildTimeCardRows(value as CartaoPontoValue)
    : buildPayrollRows(value as HoleriteValue);
  if (formato === 'csv') {
    return { body: csv([rows.headers, ...rows.rows]), contentType: 'text/csv; charset=utf-8', filename: 'transcricao.csv' };
  }

  const workbook = tipo === 'cartao-ponto'
    ? buildTimeCardWorkbook(value as CartaoPontoValue)
    : buildPayrollWorkbook(value as HoleriteValue);
  return {
    body: Buffer.from(await workbook.xlsx.writeBuffer()),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: 'transcricao.xlsx',
  };
};

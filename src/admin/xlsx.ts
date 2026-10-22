import { checkOk } from './fetch-utils';
import * as XLSX from 'xlsx';

function looksLikeExcelMimeType(contentType: string | null) {
  if (!contentType) return false;
  return /excel|spreadsheet|sheet|xlsx|xls|csv|octet-stream/i.test(contentType);
}

export async function fetchXlsx<T extends Array<unknown>>(url: URL) {
  const response = await fetch(url).then(checkOk);
  const contentType = response.headers.get('content-type');
  const body = await response.arrayBuffer();

  const preview = new TextDecoder('utf-8', { fatal: false }).decode(
    body.slice(0, Math.min(body.byteLength, 2048)),
  );

  if (!looksLikeExcelMimeType(contentType) && /<\s*(html|body|doctype)|\bParse error\b/i.test(preview)) {
    throw new Error(
      `Expected an Excel file from ${url.href}, but the endpoint returned HTML instead. ` +
      `Content-Type: ${contentType || 'unknown'}. Preview: ${preview.slice(0, 200)}...`,
    );
  }

  const workbook = XLSX.read(body, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

  return Array.from(jsonData) as T;
}

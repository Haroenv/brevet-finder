import * as XLSX from 'xlsx';

export async function fetchXlsx<T extends Array<unknown>>(url: URL) {
  const data = await fetch(url).then((res) => res.arrayBuffer());
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });

  return Array.from(jsonData) as T;
}

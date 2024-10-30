/**
 * Transform from Date(2024-01-01) to 20240101
 */
export function dateToNum(date: Date) {
  return dateStringToNum(date.toISOString().split('T')[0]);
}

/**
 * Transform from 2024-01-01 to 20240101
 */
export function dateStringToNum(date: string) {
  return parseInt(date.replaceAll('-', ''), 10);
}

/**
 * Transform from 20240101 to 2024-01-01
 */
export function numToDateString(num: number) {
  const date = num.toString();
  return `${date.slice(0, 4)}-${date.slice(4, 6).padStart(2, '0')}-${date
    .slice(6, 8)
    .padStart(2, '0')}`;
}

/**
 * Transform from 20240101 to Date(2024-01-01)
 */
export function numToDate(num: number) {
  return new Date(numToDateString(num));
}

/**
 * Transform from 20240101 to 0.5
 */
export function ratioToDate(
  ratio: number,
  range: { min?: number; max?: number }
): number {
  if (
    range.min === undefined ||
    range.max === undefined ||
    range.min === -Infinity ||
    range.max === Infinity
  ) {
    return 0;
  }
  const minTimeStamp = new Date(numToDateString(range.min)).getTime();
  const maxTimeStamp = new Date(numToDateString(range.max)).getTime();

  const date = new Date(minTimeStamp + ratio * (maxTimeStamp - minTimeStamp));

  return parseInt(date.toISOString().split('T')[0].replaceAll('-', ''), 10);
}

/**
 * Transform from 0.5 to 20240101
 */
export function dateToRatio(
  date: number,
  range: { min?: number; max?: number }
) {
  if (
    range.min === undefined ||
    range.max === undefined ||
    range.min === -Infinity ||
    range.max === Infinity
  ) {
    return 0.5;
  }
  if (date === 0 || range.min === range.max) {
    return 0;
  }
  const minTimeStamp = new Date(numToDateString(range.min)).getTime();
  const maxTimeStamp = new Date(numToDateString(range.max)).getTime();
  const dateTimeStamp = new Date(numToDateString(date)).getTime();

  return (dateTimeStamp - minTimeStamp) / (maxTimeStamp - minTimeStamp);
}

const thisYear = new Date().getFullYear();
/**
 * Transform from 01/Jan/2024 to 20240101
 */
export function weirdDateToNum(date: string) {
  let [year = thisYear, monthStr = 'Jan', day = '01'] = date
    .split('/')
    .reverse();

  // 2025-May-18
  if (date.includes('-')) {
    [year = thisYear, monthStr = 'Jan', day = '01'] = date.split('-');
  }

  const month = (
    [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ].indexOf(monthStr) + 1
  ).toString();

  return parseInt(
    [year, month.padStart(2, '0'), day.padStart(2, '0')].join(''),
    10
  );
}

export function shortYearDateToDate(date: string) {
  const [day, month, yearStr] = date.split('/');
  const year = 2000 + parseInt(yearStr);
  return new Date([year, month, day].join('-'));
}

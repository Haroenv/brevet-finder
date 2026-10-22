import { describe, expect, test, mock } from 'bun:test';
import { fetchXlsx } from './xlsx';

describe('fetchXlsx', () => {
  test('throws a clear error when the endpoint returns HTML instead of XLSX', async () => {
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response('<html><body>Parse error</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=UTF-8' },
        }),
      ),
    );

    globalThis.fetch = fetchMock as typeof fetch;

    await expect(fetchXlsx(new URL('https://example.com/broken.xlsx'))).rejects.toThrow(
      'Expected an Excel file',
    );
  });
});

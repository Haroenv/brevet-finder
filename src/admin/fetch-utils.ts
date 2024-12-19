export function checkOk(res: Response) {
  if (!res.ok) {
    throw new Error(`Failed to fetch, ${res.statusText}`, {
      cause: res.status,
    });
  }
  return res;
}

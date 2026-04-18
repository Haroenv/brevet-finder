export function debounce<TFunction extends (...args: any[]) => any>(
  callback: TFunction,
  delay: number
): (...args: Parameters<TFunction>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<TFunction>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      callback.apply(null, args);
    }, delay);
  };
}

/**
 * Creates a debounced function that executes immediately on first call,
 * then prevents re-execution during the wait period.
 *
 * @param func - The function to debounce
 * @param wait - The wait time in milliseconds
 * @returns A debounced version of the function
 */
export function debounce<F extends (...args: unknown[]) => unknown>(
  func: F,
  wait: number
): (...args: Parameters<F>) => void {
  let isThrottled = false;

  return function debouncedFunction(...args: Parameters<F>) {
    if (!isThrottled) {
      func(...args);
      isThrottled = true;
      setTimeout(() => {
        isThrottled = false;
      }, wait);
    }
  };
}

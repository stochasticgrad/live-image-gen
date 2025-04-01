import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom React hook that debounces a value, delaying updates until a specified
 * time has passed without the value changing. It also provides a function
 * to immediately update the debounced value and cancel any pending debounce timer.
 *
 * @template T The type of the value being debounced.
 * @param {T} value The value to debounce. The debounced value will update
 *   after this value has stopped changing for the specified `delay`.
 * @param {number} delay The debounce delay in milliseconds.
 * @returns {[T, (newValue: T) => void]} A tuple containing:
 *   - `[0] (T)`: The current debounced value. Initially matches the input `value`,
 *     then updates `delay` milliseconds after the input `value` has stabilized.
 *   - `[1] ((newValue: T) => void)`: A callback function to immediately set
 *     the debounced value to `newValue` and cancel any pending debounce timer
 *     associated with the original `value`.
 */
export function useDebounceWithReset<T>(value: T, delay: number): [T, (newValue: T) => void] {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref to store the timeout ID

  // Effect for standard debouncing when 'value' changes
  useEffect(() => {
    // Clear any existing timeout when value or delay changes before setting a new one
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set a new timeout to update the debounced value after the delay
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
      timeoutRef.current = null; // Clear the ref after the timeout runs
    }, delay);

    // Cleanup function: clear timeout if component unmounts or dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [value, delay]); // Re-run effect if value or delay changes

  // Function to immediately update the debounced value and cancel any pending timeout
  const resetDebouncedValue = useCallback((newValue: T) => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // Immediately set the state
    setDebouncedValue(newValue);
  }, []);

  // Return the current debounced value and the reset function
  return [debouncedValue, resetDebouncedValue];
}
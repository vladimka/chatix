import { useState, useEffect, useRef } from 'react';

// Кастомный хук для debounce
export function useDebounce(value, delay, onDebounced) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timeoutRef = useRef(null);
  const previousValueRef = useRef(value);

  useEffect(() => {
    // Если значение не изменилось - ничего не делаем
    if (value === previousValueRef.current) {
      return;
    }

    // Очищаем предыдущий таймер
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Устанавливаем новый таймер
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
      if (onDebounced) {
        onDebounced(value);
      }
      previousValueRef.current = value;
    }, delay);

    // Очистка при размонтировании
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay, onDebounced]);

  return debouncedValue;
}
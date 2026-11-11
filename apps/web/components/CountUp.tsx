'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from its previous value to the new one.
 * Under prefers-reduced-motion the value changes immediately.
 */
export function CountUp({
  value,
  format,
  duration = 900,
}: {
  value: number | undefined;
  format: (n: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState<number | undefined>(value);
  const from = useRef<number>(0);

  useEffect(() => {
    if (value === undefined) {
      setShown(undefined);
      return;
    }
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const startValue = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(startValue + (value - startValue) * eased);
      if (p < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        from.current = value;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{shown === undefined ? '–' : format(shown)}</>;
}

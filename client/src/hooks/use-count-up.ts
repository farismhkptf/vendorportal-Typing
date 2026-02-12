import { useState, useEffect, useRef } from "react";

export function useCountUp(end: number, duration: number = 800, delay: number = 0): number {
  const [count, setCount] = useState(0);
  const prevEnd = useRef(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    if (end === prevEnd.current) return;
    const startVal = prevEnd.current;
    prevEnd.current = end;

    const timeout = setTimeout(() => {
      const startTime = performance.now();

      function animate(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(startVal + (end - startVal) * eased);
        setCount(current);
        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate);
        }
      }

      frameRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [end, duration, delay]);

  return count;
}

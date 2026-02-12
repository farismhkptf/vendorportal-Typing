import { useRef, useEffect, useState } from "react";

export function useStaggeredList(count: number, baseDelay: number = 50): boolean[] {
  const [visible, setVisible] = useState<boolean[]>(new Array(count).fill(false));
  const prevCount = useRef(0);

  useEffect(() => {
    if (count === 0) return;
    if (count === prevCount.current) return;
    prevCount.current = count;

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < count; i++) {
      timers.push(
        setTimeout(() => {
          setVisible((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }, i * baseDelay)
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [count, baseDelay]);

  return visible;
}

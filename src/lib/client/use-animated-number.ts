"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberOptions {
  delay?: number;
  duration?: number;
}

export function useAnimatedNumber(
  target: number | null,
  { delay = 0, duration = 900 }: AnimatedNumberOptions = {},
) {
  const valueRef = useRef(0);
  const [value, setValue] = useState(0);

  useEffect(() => {
    let animationFrame = 0;
    let timeout = 0;

    if (target === null) {
      animationFrame = requestAnimationFrame(() => {
        valueRef.current = 0;
        setValue(0);
      });
      return () => cancelAnimationFrame(animationFrame);
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animationFrame = requestAnimationFrame(() => {
        valueRef.current = target;
        setValue(target);
      });
      return () => cancelAnimationFrame(animationFrame);
    }

    const from = valueRef.current;
    const distance = target - from;

    const start = () => {
      const startedAt = performance.now();
      const tick = (now: number) => {
        const elapsed = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - elapsed, 4);
        const next = Math.round(from + distance * eased);
        valueRef.current = next;
        setValue(next);
        if (elapsed < 1) animationFrame = requestAnimationFrame(tick);
      };
      animationFrame = requestAnimationFrame(tick);
    };

    timeout = window.setTimeout(start, delay);
    return () => {
      window.clearTimeout(timeout);
      cancelAnimationFrame(animationFrame);
    };
  }, [delay, duration, target]);

  return target === null ? null : value;
}

import { useEffect, useRef, useState } from 'react';

// Animates a number counting up from its previous value to `value` whenever
// `value` changes (including the first render, from 0). Renders the final
// value immediately for anyone with reduced-motion set, or if `value` isn't
// a finite number -- this is a nice-to-have, never a reason a number is slow
// or wrong to read.
export default function CountUp({ value, duration = 900, format = (n) => String(Math.round(n)) }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }

    const from = fromRef.current;
    let start = null;
    let frame;

    const step = (timestamp) => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(from + (target - from) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };

    frame = requestAnimationFrame(step);
    return () => {
      if (frame) cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return format(display);
}

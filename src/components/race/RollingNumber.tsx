import { useEffect, useRef, useState } from "react";

export function RollingNumber({
  value,
  duration = 500,
}: {
  value: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const start = useRef(performance.now());

  useEffect(() => {
    from.current = display;
    start.current = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from.current + (value - from.current) * eased;
      setDisplay(v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{Math.round(display).toLocaleString("en-IN")}</>;
}

import { useEffect, useRef, useState } from "react";

const DEFAULT_OPTS: IntersectionObserverInit = {
  threshold: 0.15,
  rootMargin: "0px 0px -60px 0px",
};

/** Fires once when element enters the viewport (scroll-reveal / count-up). */
export function useInView<T extends HTMLElement>(
  opts: IntersectionObserverInit = DEFAULT_OPTS,
) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        io.disconnect();
      }
    }, opts);
    io.observe(el);
    return () => io.disconnect();
    // Intentionally observe once on mount; opts are stable defaults for landing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, inView } as const;
}

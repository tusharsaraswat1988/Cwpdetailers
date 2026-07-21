import { useEffect, useState } from "react";
import { LANDING_MOTION } from "../constants";

/**
 * Triggers hero-enter animations after mount.
 * Pass a remount key (e.g. division) to replay on journey switch only.
 */
export function useHeroEnterReady(remountKey: string | number | boolean = true) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (window.matchMedia?.(LANDING_MOTION.reducedMotion).matches) {
      setReady(true);
      return;
    }
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [remountKey]);

  return ready;
}

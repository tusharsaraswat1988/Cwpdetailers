import { useCallback, useEffect, useState } from "react";

const DEFAULT_SECONDS = 30;

export function useOtpResendTimer(initialSeconds = DEFAULT_SECONDS) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  const startTimer = useCallback(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecondsLeft(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [secondsLeft]);

  const canResend = secondsLeft === 0;

  return { secondsLeft, canResend, startTimer };
}

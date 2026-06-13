import { useCallback, useEffect, useRef, useState } from "react";
import { clearDraft, loadDraft, saveDraft } from "@/services/draftService";

export function useFormDraft<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [restored, setRestored] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadDraft<T>(key).then((draft) => {
      if (cancelled || draft == null) return;
      setValue(draft);
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const setDraftValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          void saveDraft(key, resolved);
        }, 400);
        return resolved;
      });
    },
    [key],
  );

  const clear = useCallback(async () => {
    await clearDraft(key);
    setRestored(false);
  }, [key]);

  return { value, setValue: setDraftValue, clearDraft: clear, restoredFromDraft: restored };
}

import { idbDelete, idbGet, idbPut, isIndexedDBAvailable } from "./idb";

export type DraftRecord<T = unknown> = {
  key: string;
  data: T;
  updatedAt: string;
};

const LS_PREFIX = "cwp_draft_";

export async function saveDraft<T>(key: string, data: T): Promise<void> {
  const record: DraftRecord<T> = {
    key,
    data,
    updatedAt: new Date().toISOString(),
  };

  if (isIndexedDBAvailable()) {
    await idbPut("drafts", record);
    return;
  }

  localStorage.setItem(`${LS_PREFIX}${key}`, JSON.stringify(record));
}

export async function loadDraft<T>(key: string): Promise<T | null> {
  if (isIndexedDBAvailable()) {
    const record = await idbGet<DraftRecord<T>>("drafts", key);
    return record?.data ?? null;
  }

  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${key}`);
    if (!raw) return null;
    return (JSON.parse(raw) as DraftRecord<T>).data;
  } catch {
    return null;
  }
}

export async function clearDraft(key: string): Promise<void> {
  if (isIndexedDBAvailable()) {
    await idbDelete("drafts", key);
  }
  localStorage.removeItem(`${LS_PREFIX}${key}`);
}

export async function hasDraft(key: string): Promise<boolean> {
  const draft = await loadDraft(key);
  return draft != null;
}

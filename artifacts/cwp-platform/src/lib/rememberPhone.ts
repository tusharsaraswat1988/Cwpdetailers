const REMEMBER_PHONE_KEY = "cwp_remember_phone";
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

type RememberedPhone = {
  phone: string;
  savedAt: number;
};

export function loadRememberedPhone(): string {
  try {
    const raw = localStorage.getItem(REMEMBER_PHONE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as RememberedPhone;
    if (!parsed.phone || !parsed.savedAt) return "";
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(REMEMBER_PHONE_KEY);
      return "";
    }
    return parsed.phone;
  } catch {
    return "";
  }
}

export function saveRememberedPhone(phone: string): void {
  try {
    if (!phone) {
      localStorage.removeItem(REMEMBER_PHONE_KEY);
      return;
    }
    const payload: RememberedPhone = { phone, savedAt: Date.now() };
    localStorage.setItem(REMEMBER_PHONE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function clearRememberedPhone(): void {
  try {
    localStorage.removeItem(REMEMBER_PHONE_KEY);
  } catch {
    // ignore
  }
}

export function hasRememberedPhone(): boolean {
  return loadRememberedPhone().length > 0;
}

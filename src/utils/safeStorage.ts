const pendingWrites = new Map<string, number>();

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[LocalStorage] Failed to persist ${key}:`, err);
    return false;
  }
}

export function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (err) {
    console.warn(`[LocalStorage] Failed to remove ${key}:`, err);
    return false;
  }
}

export function debouncedSetItem(key: string, value: string, delayMs = 2500): void {
  const existing = pendingWrites.get(key);
  if (existing) window.clearTimeout(existing);

  const timer = window.setTimeout(() => {
    pendingWrites.delete(key);
    safeSetItem(key, value);
  }, delayMs);

  pendingWrites.set(key, timer);
}

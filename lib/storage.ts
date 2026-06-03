/**
 * User-scoped localStorage utilities.
 *
 * All pacioli-* data keys are prefixed with the Clerk userId so that multiple
 * users on the same browser never share or clobber each other's data.
 *
 * Theme (hfos-theme) is intentionally NOT scoped — it's a device preference.
 *
 * Usage:
 *   import { scopedStorage } from "@/lib/storage";
 *   const storage = scopedStorage(userId);          // userId from useAuth()
 *   storage.getItem("pacioli-budget-envelopes");    // reads "<userId>:pacioli-budget-envelopes"
 */

export type ScopedStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function scopedStorage(userId: string | null | undefined): ScopedStorage {
  const prefix = userId ? `${userId}:` : "";

  return {
    getItem(key: string): string | null {
      try {
        return localStorage.getItem(`${prefix}${key}`);
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        localStorage.setItem(`${prefix}${key}`, value);
      } catch {
        // Silently ignore (private browsing quota exceeded, etc.)
      }
    },
    removeItem(key: string): void {
      try {
        localStorage.removeItem(`${prefix}${key}`);
      } catch {
        // ignore
      }
    },
  };
}

/**
 * Migrate existing (un-prefixed) pacioli-* keys into the user's scoped namespace.
 * Call once after the user signs in for the first time on a device.
 * Safe to call multiple times — skips keys that are already migrated.
 */
export function migrateLocalStorageToUser(userId: string): void {
  const KEYS = [
    "pacioli-onboarded",
    "pacioli-category-rules",
    "pacioli-tx-overrides",
    "pacioli-imported-transactions",
    "pacioli-budget-envelopes",
    "pacioli-sinking-funds",
    "pacioli-scenario-events",
    "pacioli-scenario-delta",
    "pacioli-manual-accounts",
    "pacioli-setup-complete",
    "pacioli-setup-banner-dismissed",
    "pacioli-review-uncategorized",
    "pacioli-demo-mode",
    "pacioli-landing-theme",
  ];

  const storage = scopedStorage(userId);

  for (const key of KEYS) {
    // Already migrated
    if (storage.getItem(key) !== null) continue;

    // Migrate legacy un-prefixed value if it exists
    const legacy = localStorage.getItem(key);
    if (legacy !== null) {
      storage.setItem(key, legacy);
      // Leave the old key in place (safe — won't be read by new code)
    }
  }
}

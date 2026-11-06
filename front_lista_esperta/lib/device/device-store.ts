import { createStore, del, get, set, type UseStore } from "idb-keyval";

/**
 * Everything that lives only on this device (IndexedDB): the guest id, the
 * guest's lists and preferences. Nothing here identifies the person.
 */
let store: UseStore | null = null;
function deviceStore(): UseStore {
  store ??= createStore("lista-esperta", "device");
  return store;
}

const GUEST_ID_KEY = "guestId";

export function readDevice<T>(key: string): Promise<T | undefined> {
  return get<T>(key, deviceStore());
}

export function writeDevice<T>(key: string, value: T): Promise<void> {
  return set(key, value, deviceStore());
}

export function deleteDevice(key: string): Promise<void> {
  return del(key, deviceStore());
}

/** Anonymous id generated on first use and sent as X-Guest-Id on writes only. */
export async function getGuestId(): Promise<string> {
  const existing = await readDevice<string>(GUEST_ID_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  await writeDevice(GUEST_ID_KEY, created);
  return created;
}

export interface DevicePreferences {
  radiusKm: number;
  /** Old entries have no source: treated as an unchecked guess (D-075). */
  lastLocation?: {
    lat: number;
    lng: number;
    at: string;
    source?: "gps" | "address";
    accuracyM?: number;
    label?: string;
  };
}

export const DEFAULT_PREFERENCES: DevicePreferences = { radiusKm: 5 };

export async function readPreferences(): Promise<DevicePreferences> {
  return { ...DEFAULT_PREFERENCES, ...(await readDevice<Partial<DevicePreferences>>("preferences")) };
}

export async function writePreferences(patch: Partial<DevicePreferences>): Promise<DevicePreferences> {
  const next = { ...(await readPreferences()), ...patch };
  await writeDevice("preferences", next);
  return next;
}

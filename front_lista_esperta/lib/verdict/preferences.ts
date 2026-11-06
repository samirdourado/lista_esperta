"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PREFERENCES, readPreferences, writePreferences } from "@/lib/device/device-store";
import { useSession, useUpdateProfile } from "@/lib/session";

export interface SearchPreferences {
  radiusKm: number;
}

/**
 * How far to look for stores: from the account when signed in, from the
 * device otherwise. The verdict ranks by the list price alone (D-069).
 */
export function useSearchPreferences() {
  const { data: user, isPending } = useSession();
  const update = useUpdateProfile();
  const [device, setDevice] = useState<SearchPreferences | null>(null);

  useEffect(() => {
    readPreferences()
      .then((prefs) => setDevice({ radiusKm: prefs.radiusKm }))
      .catch(() => setDevice({ radiusKm: DEFAULT_PREFERENCES.radiusKm }));
  }, []);

  const preferences: SearchPreferences | null = user ? { radiusKm: user.defaultRadiusKm } : isPending ? null : device;

  const save = useCallback(
    async (patch: Partial<SearchPreferences>) => {
      if (user) {
        if (patch.radiusKm !== undefined) await update.mutateAsync({ defaultRadiusKm: patch.radiusKm });
      } else {
        const next = await writePreferences(patch);
        setDevice({ radiusKm: next.radiusKm });
      }
    },
    [user, update],
  );

  return { preferences, save };
}

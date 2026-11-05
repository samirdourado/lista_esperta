"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PREFERENCES, readPreferences, writePreferences } from "@/lib/device/device-store";
import { useSession, useUpdateProfile } from "@/lib/session";

export interface TravelPreferences {
  radiusKm: number;
  costPerKm: number;
  valuePerHour: number;
}

/**
 * Travel preferences: from the account when signed in, from the device
 * otherwise (spec section 3: guests keep radius, R$/km and value of time locally).
 */
export function useTravelPreferences() {
  const { data: user, isPending } = useSession();
  const update = useUpdateProfile();
  const [device, setDevice] = useState<TravelPreferences | null>(null);

  useEffect(() => {
    readPreferences()
      .then((prefs) =>
        setDevice({ radiusKm: prefs.radiusKm, costPerKm: prefs.costPerKm, valuePerHour: prefs.valuePerHour }),
      )
      .catch(() => setDevice({ radiusKm: DEFAULT_PREFERENCES.radiusKm, costPerKm: 1, valuePerHour: 0 }));
  }, []);

  const preferences: TravelPreferences | null = user
    ? { radiusKm: user.defaultRadiusKm, costPerKm: user.costPerKm, valuePerHour: user.valuePerHour }
    : isPending
      ? null
      : device;

  const save = useCallback(
    async (patch: Partial<TravelPreferences>) => {
      if (user) {
        await update.mutateAsync({
          ...(patch.radiusKm !== undefined ? { defaultRadiusKm: patch.radiusKm } : {}),
          ...(patch.costPerKm !== undefined ? { costPerKm: patch.costPerKm } : {}),
          ...(patch.valuePerHour !== undefined ? { valuePerHour: patch.valuePerHour } : {}),
        });
      } else {
        const next = await writePreferences(patch);
        setDevice({ radiusKm: next.radiusKm, costPerKm: next.costPerKm, valuePerHour: next.valuePerHour });
      }
    },
    [user, update],
  );

  return { preferences, save };
}

"use client";

import { useCallback } from "react";
import { readDevice, writeDevice } from "@/lib/device/device-store";
import { useShoppingListRepository } from "@/lib/session";
import { CURRENT_LIST_KEY } from "./migrate";
import { DEFAULT_LIST_NAME, type ShoppingList, type ShoppingListItem } from "./repository";

/**
 * The list being edited on the home screen. Guests keep it on the device,
 * signed-in users in the account; the device only remembers which one it is.
 */
export function useCurrentList() {
  const repository = useShoppingListRepository();

  const load = useCallback(async (): Promise<ShoppingList | undefined> => {
    const id = await readDevice<string>(CURRENT_LIST_KEY);
    if (id) {
      const list = await repository.get(id);
      if (list) return list;
    }
    return (await repository.list())[0];
  }, [repository]);

  const save = useCallback(
    async (items: ShoppingListItem[]): Promise<ShoppingList> => {
      const id = await readDevice<string>(CURRENT_LIST_KEY);
      const existing = id ? await repository.get(id) : undefined;
      const saved = await repository.save({
        id: existing?.id,
        name: existing?.name ?? DEFAULT_LIST_NAME,
        items,
      });
      await writeDevice(CURRENT_LIST_KEY, saved.id);
      return saved;
    },
    [repository],
  );

  return { load, save, kind: repository.kind };
}

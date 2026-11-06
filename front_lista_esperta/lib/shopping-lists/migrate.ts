import { api } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import type { ImportResult } from "@/lib/api/types";
import { deleteDevice, getGuestId, readDevice, writeDevice } from "@/lib/device/device-store";
import { LocalShoppingListRepository } from "./local";
import type { ShoppingListItem } from "./repository";

export const CURRENT_LIST_KEY = "currentListId";

type ImportCall = (body: {
  guestId: string;
  lists: {
    clientId: string;
    name: string;
    items: { freeText: string; quantity: number; webPrice?: ShoppingListItem["webPrice"] }[];
  }[];
}) => Promise<ImportResult>;

const importViaApi: ImportCall = async (body) => unwrap(await api.POST("/api/v1/shopping-lists/import", { body }));

/**
 * Runs right after sign-up or sign-in: sends the device's lists (and the guest
 * id, so receipts sent as guest move too) to the account, then clears the
 * local copies. From here on the server is the source of truth.
 */
export async function migrateGuestDataToAccount(
  local = new LocalShoppingListRepository(),
  importLists: ImportCall = importViaApi,
): Promise<ImportResult> {
  const lists = await local.list();
  const guestId = await getGuestId();
  const result = await importLists({
    guestId,
    lists: lists
      .filter((list) => list.items.length > 0)
      .map((list) => ({
        clientId: list.id,
        name: list.name,
        items: list.items.map((item) => ({
          freeText: item.freeText,
          quantity: item.quantity,
          ...(item.webPrice ? { webPrice: item.webPrice } : {}),
        })),
      })),
  });

  // Keep pointing at the same list, now by its server id.
  const currentLocalId = await readDevice<string>(CURRENT_LIST_KEY);
  const current = result.lists.find((list) => list.clientId === currentLocalId);
  if (current) await writeDevice(CURRENT_LIST_KEY, current.id);
  else if (currentLocalId) await deleteDevice(CURRENT_LIST_KEY);

  await local.clear();
  return result;
}

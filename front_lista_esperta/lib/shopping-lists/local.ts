import { readDevice, writeDevice } from "@/lib/device/device-store";
import type { ShoppingList, ShoppingListDraft, ShoppingListRepository } from "./repository";

const LISTS_KEY = "shoppingLists";

/** Guest lists, kept in IndexedDB so they also work offline. */
export class LocalShoppingListRepository implements ShoppingListRepository {
  readonly kind = "local" as const;

  private async all(): Promise<ShoppingList[]> {
    return (await readDevice<ShoppingList[]>(LISTS_KEY)) ?? [];
  }

  async list(): Promise<ShoppingList[]> {
    return (await this.all()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<ShoppingList | undefined> {
    return (await this.all()).find((list) => list.id === id);
  }

  async save(draft: ShoppingListDraft): Promise<ShoppingList> {
    const lists = await this.all();
    const saved: ShoppingList = {
      id: draft.id ?? crypto.randomUUID(),
      name: draft.name,
      items: draft.items,
      updatedAt: new Date().toISOString(),
    };
    const index = lists.findIndex((list) => list.id === saved.id);
    if (index >= 0) lists[index] = saved;
    else lists.push(saved);
    await writeDevice(LISTS_KEY, lists);
    return saved;
  }

  async remove(id: string): Promise<void> {
    await writeDevice(
      LISTS_KEY,
      (await this.all()).filter((list) => list.id !== id),
    );
  }

  /** After migrating to an account the server becomes the source of truth. */
  async clear(): Promise<void> {
    await writeDevice(LISTS_KEY, []);
  }
}

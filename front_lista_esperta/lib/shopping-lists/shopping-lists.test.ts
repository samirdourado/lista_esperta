import "fake-indexeddb/auto";
import { clear, createStore } from "idb-keyval";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportResult } from "@/lib/api/types";
import { getGuestId, readDevice, writeDevice } from "@/lib/device/device-store";
import { LocalShoppingListRepository } from "./local";
import { CURRENT_LIST_KEY, migrateGuestDataToAccount } from "./migrate";

beforeEach(async () => {
  await clear(createStore("lista-esperta", "device"));
});

describe("LocalShoppingListRepository", () => {
  it("creates, updates, lists newest first and removes lists on the device", async () => {
    const repo = new LocalShoppingListRepository();
    const first = await repo.save({ name: "Mercado", items: [{ freeText: "arroz", quantity: 1 }] });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await repo.save({ name: "Farmácia", items: [] });

    expect((await repo.list()).map((l) => l.name)).toEqual(["Farmácia", "Mercado"]);

    const updated = await repo.save({ id: first.id, name: "Mercado", items: [{ freeText: "café", quantity: 2 }] });
    expect(updated.id).toBe(first.id);
    expect((await repo.get(first.id))?.items).toEqual([{ freeText: "café", quantity: 2 }]);

    await repo.remove(second.id);
    expect(await repo.list()).toHaveLength(1);
  });

  it("keeps a stable guest id per device", async () => {
    const id = await getGuestId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await getGuestId()).toBe(id);
  });
});

describe("migrateGuestDataToAccount", () => {
  it("sends non-empty lists with the guest id, re-points the current list and clears the device", async () => {
    const local = new LocalShoppingListRepository();
    const kept = await local.save({ name: "Mercado", items: [{ freeText: "arroz 5kg", quantity: 1 }] });
    await local.save({ name: "Vazia", items: [] });
    await writeDevice(CURRENT_LIST_KEY, kept.id);
    const guestId = await getGuestId();

    const importLists = vi.fn(async (): Promise<ImportResult> => ({
      imported: 1,
      receiptsClaimed: 2,
      pricesClaimed: 0,
      lists: [{ id: "server-id", clientId: kept.id, name: "Mercado", updatedAt: "", items: [] }],
    }));

    const result = await migrateGuestDataToAccount(local, importLists);

    expect(importLists).toHaveBeenCalledWith({
      guestId,
      lists: [{ clientId: kept.id, name: "Mercado", items: [{ freeText: "arroz 5kg", quantity: 1 }] }],
    });
    expect(result.receiptsClaimed).toBe(2);
    expect(await readDevice(CURRENT_LIST_KEY)).toBe("server-id");
    expect(await local.list()).toEqual([]);
    // The guest id survives: it still identifies this device for anonymous writes.
    expect(await getGuestId()).toBe(guestId);
  });

  it("keeps local lists when the import fails", async () => {
    const local = new LocalShoppingListRepository();
    await local.save({ name: "Mercado", items: [{ freeText: "arroz", quantity: 1 }] });
    await expect(migrateGuestDataToAccount(local, () => Promise.reject(new Error("offline")))).rejects.toThrow();
    expect(await local.list()).toHaveLength(1);
  });
});

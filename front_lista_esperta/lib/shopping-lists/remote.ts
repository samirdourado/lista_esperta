import { api } from "@/lib/api/client";
import { ApiError, unwrap } from "@/lib/api/errors";
import type { ServerShoppingList } from "@/lib/api/types";
import type { ShoppingList, ShoppingListDraft, ShoppingListRepository } from "./repository";

function fromServer(list: ServerShoppingList): ShoppingList {
  return {
    id: list.id,
    name: list.name,
    updatedAt: list.updatedAt,
    items: list.items.map((item) => ({
      freeText: item.freeText,
      quantity: item.quantity,
      productId: item.productId,
      webPrice: item.webPrice,
    })),
  };
}

function toBody(draft: ShoppingListDraft) {
  return {
    name: draft.name,
    items: draft.items.map((item) => ({
      freeText: item.freeText,
      quantity: item.quantity,
      ...(item.productId ? { productId: item.productId } : {}),
      ...(item.webPrice ? { webPrice: item.webPrice } : {}),
    })),
  };
}

/** Lists of a signed-in user, stored by the API. */
export class RemoteShoppingListRepository implements ShoppingListRepository {
  readonly kind = "remote" as const;

  async list(): Promise<ShoppingList[]> {
    return unwrap(await api.GET("/api/v1/shopping-lists")).map(fromServer);
  }

  async get(id: string): Promise<ShoppingList | undefined> {
    try {
      return fromServer(unwrap(await api.GET("/api/v1/shopping-lists/{id}", { params: { path: { id } } })));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return undefined;
      throw error;
    }
  }

  async save(draft: ShoppingListDraft): Promise<ShoppingList> {
    const body = toBody(draft);
    const result = draft.id
      ? await api.PUT("/api/v1/shopping-lists/{id}", { params: { path: { id: draft.id } }, body })
      : await api.POST("/api/v1/shopping-lists", { body });
    return fromServer(unwrap(result));
  }

  async remove(id: string): Promise<void> {
    unwrap(await api.DELETE("/api/v1/shopping-lists/{id}", { params: { path: { id } } }));
  }
}

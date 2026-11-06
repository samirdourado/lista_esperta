/** A price seen on Google Shopping when the item was added: reference only (D-070). */
export interface WebPrice {
  title: string;
  price: number;
  store: string;
  url?: string | null;
  seenAt: string;
}

export interface ShoppingListItem {
  freeText: string;
  quantity: number;
  productId?: string | null;
  webPrice?: WebPrice | null;
}

export interface ShoppingList {
  id: string;
  name: string;
  items: ShoppingListItem[];
  updatedAt: string;
}

export interface ShoppingListDraft {
  /** Omit to create a new list. */
  id?: string;
  name: string;
  items: ShoppingListItem[];
}

/**
 * One interface, two homes: the device (guests) or the API (signed-in users).
 * Screens only talk to this interface and never know which one is in use.
 */
export interface ShoppingListRepository {
  readonly kind: "local" | "remote";
  list(): Promise<ShoppingList[]>;
  get(id: string): Promise<ShoppingList | undefined>;
  save(draft: ShoppingListDraft): Promise<ShoppingList>;
  remove(id: string): Promise<void>;
}

export const DEFAULT_LIST_NAME = "Minha lista";

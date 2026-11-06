import type { components } from "./schema";

type Schemas = components["schemas"];

export type User = Schemas["UserResponseDto"];
export type Role = Schemas["Role"];
export type SignUpRole = Schemas["RegisterDto"]["role"];
export type ServerShoppingList = Schemas["ShoppingListResponseDto"];
export type ImportResult = Schemas["ImportShoppingListsResponseDto"];
export type WebOffer = Schemas["WebOfferDto"];
export type WebPriceResult = Schemas["WebPriceResponseDto"];

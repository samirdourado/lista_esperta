import { z } from "zod";
import { isValidCnpj, normalizeCnpj } from "@/lib/cnpj";
import type { Point } from "@/lib/location/use-location";
import type { CreateStoreBody, StoreAddress } from "./queries";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato 08:00.");

const hoursGroup = z
  .object({ open: z.boolean(), from: time, to: time })
  .refine((group) => !group.open || group.from !== group.to, {
    message: "Abertura e fechamento não podem ser iguais.",
    path: ["to"],
  });

const optionalText = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`);

export const storeFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da loja.").max(120, "Use no máximo 120 caracteres."),
  cnpj: z
    .string()
    .trim()
    .refine((value) => value === "" || isValidCnpj(value), "Esse CNPJ não é válido. Confira os números."),
  street: optionalText(200).min(1, "Informe a rua."),
  number: optionalText(20),
  district: optionalText(120),
  city: optionalText(120).min(1, "Informe a cidade."),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a sigla do estado, como SP."),
  postcode: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{5}-?\d{3}$/.test(value), "Use o CEP com 8 números."),
  weekdays: hoursGroup,
  saturday: hoursGroup,
  sunday: hoursGroup,
  categories: z.array(z.string()).min(1, "Escolha pelo menos uma categoria."),
});

export type StoreFormValues = z.infer<typeof storeFormSchema>;

export const DEFAULT_HOURS = {
  weekdays: { open: true, from: "08:00", to: "20:00" },
  saturday: { open: true, from: "08:00", to: "18:00" },
  sunday: { open: false, from: "08:00", to: "13:00" },
};

export function defaultStoreForm(name: string, address: StoreAddress | undefined): StoreFormValues {
  return {
    name,
    cnpj: "",
    street: address?.street ?? "",
    number: address?.number ?? "",
    district: address?.district ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    postcode: address?.postcode ?? "",
    ...DEFAULT_HOURS,
    categories: [],
  };
}

type Group = StoreFormValues["weekdays"];
const ranges = (group: Group) => (group.open ? [{ open: group.from, close: group.to }] : []);

/** Form values + pin position → POST /stores body. */
export function toCreateStoreBody(values: StoreFormValues, point: Point, confirmNotDuplicate = false): CreateStoreBody {
  const weekday = ranges(values.weekdays);
  const address = Object.fromEntries(
    Object.entries({
      street: values.street,
      number: values.number,
      district: values.district,
      city: values.city,
      state: values.state,
      postcode: values.postcode,
    }).filter(([, value]) => value !== ""),
  );
  return {
    name: values.name,
    ...(values.cnpj ? { cnpj: normalizeCnpj(values.cnpj) } : {}),
    lat: point.lat,
    lng: point.lng,
    address,
    openingHours: {
      weekly: {
        mon: weekday,
        tue: weekday,
        wed: weekday,
        thu: weekday,
        fri: weekday,
        sat: ranges(values.saturday),
        sun: ranges(values.sunday),
      },
    },
    categorySlugs: values.categories,
    ...(confirmNotDuplicate ? { confirmNotDuplicate: true } : {}),
  };
}

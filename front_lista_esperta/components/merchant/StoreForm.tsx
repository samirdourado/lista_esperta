"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch, type UseFormRegister } from "react-hook-form";
import { PinPicker } from "@/components/map/PinPicker";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { maskCnpj } from "@/lib/cnpj";
import { cx } from "@/lib/cx";
import type { Point } from "@/lib/location/use-location";
import { STORE_CATEGORIES } from "@/lib/stores/categories";
import { useCreateStore, type CreateStoreResult, type StoreAddress } from "@/lib/stores/queries";
import { defaultStoreForm, storeFormSchema, toCreateStoreBody, type StoreFormValues } from "@/lib/stores/store-form";

export interface DuplicateHint {
  storeId: string;
  storeName: string;
}

/** "Minha loja não está no mapa": registers it with the pin, hours and categories. */
export function StoreForm({
  initialName,
  initialPoint,
  initialAddress,
  onCreated,
  onClaimInstead,
}: {
  initialName: string;
  initialPoint: Point;
  initialAddress?: StoreAddress;
  onCreated: (result: CreateStoreResult) => void;
  onClaimInstead: (hint: DuplicateHint) => void;
}) {
  const [point, setPoint] = useState(initialPoint);
  const [duplicate, setDuplicate] = useState<DuplicateHint | null>(null);
  const create = useCreateStore();
  const form = useForm<StoreFormValues>({
    resolver: zodResolver(storeFormSchema),
    defaultValues: defaultStoreForm(initialName, initialAddress),
  });
  const { errors, isSubmitting } = form.formState;
  const categories = useWatch({ control: form.control, name: "categories" });

  const submit = (confirmNotDuplicate: boolean) =>
    form.handleSubmit(async (values) => {
      try {
        onCreated(await create.mutateAsync(toCreateStoreBody(values, point, confirmNotDuplicate)));
      } catch (error) {
        if (error instanceof ApiError && error.code === "POSSIBLE_DUPLICATE") {
          setDuplicate({ storeId: String(error.body.storeId), storeName: String(error.body.storeName) });
          return;
        }
        form.setError("root", { message: errorMessage(error) });
      }
    });

  return (
    <form onSubmit={submit(false)} noValidate className="flex flex-col gap-6">
      {errors.root?.message && <Notice tone="danger" title={errors.root.message} />}
      {duplicate && (
        <Notice
          tone="warning"
          title={`Já existe “${duplicate.storeName}” neste ponto do mapa`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="md" onClick={() => onClaimInstead(duplicate)}>
                É a minha loja: pedir para administrar
              </Button>
              <Button size="md" variant="secondary" onClick={() => void submit(true)()}>
                É outra loja: cadastrar mesmo assim
              </Button>
            </div>
          }
        >
          Para não aparecer duas vezes, peça para administrar a loja que já está no mapa.
        </Notice>
      )}

      <TextField label="Nome da loja" error={errors.name?.message} {...form.register("name")} />
      <TextField
        label="CNPJ (recomendado)"
        hint="Com o CNPJ conferimos sua loja na Receita Federal e ela ganha o selo de verificada."
        inputMode="numeric"
        error={errors.cnpj?.message}
        {...form.register("cnpj", {
          onChange: (event: { target: { value: string } }) => form.setValue("cnpj", maskCnpj(event.target.value)),
        })}
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="text-xl font-bold">Endereço</legend>
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <TextField
            label="Rua"
            autoComplete="address-line1"
            error={errors.street?.message}
            {...form.register("street")}
          />
          <TextField label="Número" error={errors.number?.message} {...form.register("number")} />
        </div>
        <TextField label="Bairro" error={errors.district?.message} {...form.register("district")} />
        <div className="grid gap-4 sm:grid-cols-[1fr_6rem_9rem]">
          <TextField
            label="Cidade"
            autoComplete="address-level2"
            error={errors.city?.message}
            {...form.register("city")}
          />
          <TextField label="UF" maxLength={2} error={errors.state?.message} {...form.register("state")} />
          <TextField
            label="CEP"
            inputMode="numeric"
            autoComplete="postal-code"
            error={errors.postcode?.message}
            {...form.register("postcode")}
          />
        </div>
        <div>
          <p className="font-medium">Posição no mapa</p>
          <p className="text-[0.9rem] text-ink-soft">Arraste o marcador até a porta da loja, ou toque no mapa.</p>
          <PinPicker value={point} onChange={setPoint} className="mt-2 h-64" />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-xl font-bold">Horário de funcionamento</legend>
        <HoursRow
          label="Segunda a sexta"
          name="weekdays"
          register={form.register}
          control={form.control}
          error={errors.weekdays?.to?.message}
        />
        <HoursRow
          label="Sábado"
          name="saturday"
          register={form.register}
          control={form.control}
          error={errors.saturday?.to?.message}
        />
        <HoursRow
          label="Domingo"
          name="sunday"
          register={form.register}
          control={form.control}
          error={errors.sunday?.to?.message}
        />
      </fieldset>

      <fieldset>
        <legend className="text-xl font-bold">O que a loja vende</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {STORE_CATEGORIES.map((category) => (
            <label
              key={category.slug}
              className={cx(
                "flex min-h-tap cursor-pointer items-center gap-3 rounded-md border bg-surface px-3",
                categories.includes(category.slug) ? "border-brand" : "border-line",
              )}
            >
              <input
                type="checkbox"
                value={category.slug}
                className="size-5 accent-[var(--brand)]"
                {...form.register("categories")}
              />
              {category.label}
            </label>
          ))}
        </div>
        {errors.categories?.message && (
          <p className="mt-1.5 text-[0.9rem] font-medium text-danger">{errors.categories.message}</p>
        )}
      </fieldset>

      <Button type="submit" size="lg" block loading={isSubmitting}>
        Cadastrar loja
      </Button>
    </form>
  );
}

function HoursRow({
  label,
  name,
  register,
  control,
  error,
}: {
  label: string;
  name: "weekdays" | "saturday" | "sunday";
  register: UseFormRegister<StoreFormValues>;
  control: ReturnType<typeof useForm<StoreFormValues>>["control"];
  error?: string;
}) {
  const open = useWatch({ control, name: `${name}.open` });
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-surface px-3 py-2">
      <label className="flex min-h-tap w-44 items-center gap-2 font-medium">
        <input type="checkbox" className="size-5 accent-[var(--brand)]" {...register(`${name}.open`)} />
        {label}
      </label>
      {open ? (
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`${name}-from`}>
            {label}: abre às
          </label>
          <input
            id={`${name}-from`}
            type="time"
            className="min-h-tap rounded-sm border border-line-strong bg-surface px-2"
            {...register(`${name}.from`)}
          />
          <span aria-hidden="true">até</span>
          <label className="sr-only" htmlFor={`${name}-to`}>
            {label}: fecha às
          </label>
          <input
            id={`${name}-to`}
            type="time"
            className="min-h-tap rounded-sm border border-line-strong bg-surface px-2"
            {...register(`${name}.to`)}
          />
        </div>
      ) : (
        <span className="text-ink-soft">Fechado</span>
      )}
      {error && <p className="w-full text-[0.9rem] font-medium text-danger">{error}</p>}
    </div>
  );
}

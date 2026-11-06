"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { LocationPrompt } from "@/components/location/LocationPrompt";
import { Button, buttonClasses } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Skeleton } from "@/components/ui/Skeleton";
import { type PriceAlert, useAlerts, useCreateAlert, useDeleteAlert, useUpdateAlert } from "@/lib/alerts/queries";
import { type PushStatus, usePush } from "@/lib/alerts/push";
import { errorMessage } from "@/lib/api/errors";
import { brl } from "@/lib/format";
import { useLocation } from "@/lib/location/use-location";
import { packLabel } from "@/lib/merchant/labels";
import { useProductSearch } from "@/lib/merchant/queries";
import { useSession } from "@/lib/session";

const RADII = [1, 2, 5, 10];
const DATE = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const PUSH_NOTE: Partial<Record<PushStatus, string>> = {
  unsupported:
    "Este navegador não recebe notificações. No iPhone, instale o app na tela de início (Compartilhar › Adicionar à Tela de Início).",
  "no-worker": "As notificações funcionam no app instalado (build de produção).",
  off: "As notificações ainda não foram ligadas neste servidor. Os alertas aparecem nesta página.",
  denied: "As notificações estão bloqueadas para este site. Libere nas configurações do navegador.",
};

function NotificationsCard() {
  const push = usePush();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (done) setMessage(done);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="push" className="rounded-md border border-line bg-surface p-4">
      <h2 id="push" className="font-semibold">
        Notificações neste aparelho
      </h2>
      {push.status === "checking" && <Skeleton className="mt-2 h-6 w-1/2" />}
      {PUSH_NOTE[push.status] && <p className="mt-1 text-ink-soft">{PUSH_NOTE[push.status]}</p>}
      {push.status === "ready" && (
        <>
          <p className="mt-1 text-ink-soft">Receba um aviso quando um preço baixar, mesmo com o app fechado.</p>
          <Button className="mt-3" loading={busy} onClick={() => run(push.enable)}>
            Ligar notificações
          </Button>
        </>
      )}
      {push.status === "subscribed" && (
        <>
          <p className="mt-1 text-ink-soft">Ligadas. Avisamos uma vez a cada preço novo mais baixo.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={busy}
              onClick={() =>
                run(async () => {
                  const sent = await push.test();
                  setMessage(
                    sent > 0
                      ? "Enviamos uma notificação de teste."
                      : "Não conseguimos enviar o teste. Desligue e ligue de novo.",
                  );
                })
              }
            >
              Testar
            </Button>
            <Button variant="ghost" onClick={() => run(push.disable)}>
              Desligar
            </Button>
          </div>
        </>
      )}
      {message && (
        <p role="status" className="mt-2 text-[0.95rem]">
          {message}
        </p>
      )}
    </section>
  );
}

function NewAlert({ defaultRadiusKm }: { defaultRadiusKm: number }) {
  const params = useSearchParams();
  const location = useLocation();
  const create = useCreateAlert();
  const [product, setProduct] = useState<{ id: string; name: string } | null>(() => {
    const id = params.get("product");
    return id ? { id, name: params.get("name") ?? "Produto da sua lista" } : null;
  });
  const [q, setQ] = useState("");
  const results = useProductSearch(q).data ?? [];
  const [price, setPrice] = useState("");
  const [radiusKm, setRadiusKm] = useState(RADII.includes(defaultRadiusKm) ? defaultRadiusKm : 5);
  const target = Number(price.replace(",", "."));

  return (
    <section aria-labelledby="new-alert" className="flex flex-col gap-4">
      <h2 id="new-alert" className="text-xl font-bold">
        Novo alerta
      </h2>
      {product ? (
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-semibold">{product.name}</span>
          <button
            type="button"
            className="min-h-tap text-[0.95rem] text-brand underline underline-offset-4"
            onClick={() => setProduct(null)}
          >
            Trocar produto
          </button>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <TextField
            id="alert-product"
            label="Produto"
            placeholder="Ex.: leite integral"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            autoComplete="off"
          />
          {q.length >= 2 && (
            <ul className="divide-y divide-line rounded-md border border-line bg-surface">
              {results.length === 0 && <li className="p-3 text-ink-soft">Nenhum produto com esse nome no catálogo.</li>}
              {results.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex min-h-tap w-full items-center px-3 text-left hover:bg-surface-sunken"
                    onClick={() => {
                      setProduct({ id: item.id, name: item.canonicalName });
                      setQ("");
                    }}
                  >
                    {item.canonicalName}
                    <span className="ml-1 text-[0.9rem] text-ink-soft">
                      · {packLabel(item.unit, item.unitQuantity)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {location.point ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!product || !(target > 0)) return;
            create.mutate(
              { productId: product.id, targetPrice: Math.round(target * 100) / 100, origin: location.point!, radiusKm },
              {
                onSuccess: () => {
                  setProduct(null);
                  setPrice("");
                },
              },
            );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="alert-price"
              label="Avisar quando custar até (R$)"
              inputMode="decimal"
              placeholder="0,00"
              required
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              error={price && !(target > 0) ? "Digite um valor como 4,99." : undefined}
            />
            <fieldset>
              <legend className="font-medium">Em lojas a até</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {RADII.map((km) => (
                  <label key={km} className="inline-flex min-h-tap cursor-pointer items-center gap-2 pr-2">
                    <input
                      type="radio"
                      name="alert-radius"
                      value={km}
                      checked={radiusKm === km}
                      onChange={() => setRadiusKm(km)}
                      className="size-5 accent-(--brand)"
                    />
                    {km} km
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <p className="text-[0.9rem] text-ink-soft">
            {location.source === "address" && location.label
              ? `Perto de ${location.label}.`
              : "Perto de onde você está."}
          </p>
          {create.isError && <Notice tone="danger" title={errorMessage(create.error)} />}
          <Button type="submit" loading={create.isPending} disabled={!product} className="self-start">
            Criar alerta
          </Button>
        </form>
      ) : (
        <LocationPrompt
          status={location.status}
          intro="Para avisar sobre lojas perto de você, precisamos saber de onde você compra."
          approximateM={location.approximate?.accuracyM}
          onUseApproximate={location.acceptApproximate}
          onLocate={() => void location.locate()}
          onPick={(place) => location.setManual({ lat: place.lat, lng: place.lng }, place.label)}
        />
      )}
    </section>
  );
}

function AlertRow({ alert }: { alert: PriceAlert }) {
  const update = useUpdateAlert();
  const remove = useDeleteAlert();
  const below = alert.best && alert.best.price <= alert.targetPrice;
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold">{alert.product.canonicalName}</p>
        <p className="text-[0.9rem] text-ink-soft">
          Até {brl(alert.targetPrice)} · {alert.radiusKm.toLocaleString("pt-BR")} km
          {!alert.active && " · pausado"}
        </p>
        <p className={below ? "text-[0.95rem] font-medium text-success" : "text-[0.95rem] text-ink-soft"}>
          {alert.best
            ? `Agora: ${brl(alert.best.price)} no ${alert.best.storeName} (${alert.best.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km)`
            : "Ainda sem preço por perto."}
        </p>
        {alert.notifiedAt && (
          <p className="text-[0.85rem] text-muted">Último aviso: {DATE.format(new Date(alert.notifiedAt))}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="ghost"
          loading={update.isPending}
          onClick={() => update.mutate({ id: alert.id, active: !alert.active })}
        >
          {alert.active ? "Pausar" : "Retomar"}
        </Button>
        <Button
          variant="ghost"
          loading={remove.isPending}
          onClick={() => remove.mutate(alert.id)}
          aria-label={`Apagar alerta de ${alert.product.canonicalName}`}
        >
          Apagar
        </Button>
      </div>
    </li>
  );
}

/** Price alerts: an account perk (spec section 3). */
export function AlertsView() {
  const { data: user, isPending } = useSession();
  const alerts = useAlerts(Boolean(user));

  if (isPending) return <Skeleton className="mt-6 h-40 w-full" />;
  if (!user) {
    return (
      <div className="mt-6 flex flex-col items-start gap-4">
        <p className="text-ink-soft">
          Crie uma conta grátis para receber um aviso quando um produto da sua lista baixar de preço perto de você.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/register?next=/alerts" className={buttonClasses()}>
            Criar conta grátis
          </Link>
          <Link href="/login?next=/alerts" className={buttonClasses({ variant: "secondary" })}>
            Entrar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <NotificationsCard />
      <NewAlert defaultRadiusKm={user.defaultRadiusKm} />
      <section aria-labelledby="my-alerts" className="flex flex-col gap-3">
        <h2 id="my-alerts" className="text-xl font-bold">
          Seus alertas
        </h2>
        {alerts.isPending && <Skeleton className="h-20 w-full" />}
        {alerts.isError && <Notice tone="danger" title={errorMessage(alerts.error)} />}
        {alerts.data?.length === 0 && <p className="text-ink-soft">Nenhum alerta ainda.</p>}
        {alerts.data && alerts.data.length > 0 && (
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {alerts.data.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

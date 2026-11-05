import { VerifiedIcon } from "@/components/icons";
import { cx } from "@/lib/cx";
import { storeKind } from "@/lib/stores/categories";
import type { Store } from "@/lib/stores/queries";

export function formatDistance(km: number | undefined): string | null {
  if (km === undefined) return null;
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

export function addressLine(address: Store["address"]): string | null {
  if (!address) return null;
  const street = [address.street, address.number].filter(Boolean).join(", ");
  return [street, address.district, address.city].filter(Boolean).join(" · ") || null;
}

/** Verified stores say so; unverified ones get a quiet note, never a warning. */
export function VerificationNote({ status }: { status: Store["verificationStatus"] }) {
  if (status === "VERIFIED") {
    return (
      <span className="inline-flex items-center gap-1 text-[0.85rem] font-medium text-success">
        <VerifiedIcon width="1em" height="1em" />
        Loja verificada
      </span>
    );
  }
  return <span className="text-[0.85rem] text-muted">Loja não verificada</span>;
}

/** Name, kind, distance and address of a store, for lists. */
export function StoreSummary({ store, className }: { store: Store; className?: string }) {
  const kind = storeKind(store.categories);
  const distance = formatDistance(store.distanceKm);
  const address = addressLine(store.address);
  return (
    <div className={cx("min-w-0", className)}>
      <p className="flex items-baseline justify-between gap-3">
        <span className="truncate font-semibold">{store.name}</span>
        {distance && <span className="shrink-0 text-[0.9rem] text-ink-soft tabular-nums">{distance}</span>}
      </p>
      <p className="text-[0.9rem] text-ink-soft">
        {[kind, address].filter(Boolean).join(" · ") || "Endereço não informado"}
      </p>
      <VerificationNote status={store.verificationStatus} />
    </div>
  );
}

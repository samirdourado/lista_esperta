import { nameSimilarity, normalizeText } from '../common/text.js';
import type { CompanyRecord } from '../integrations/providers.js';
import type { StoreAddress } from './store.types.js';

export interface VerificationChecks {
  active: boolean;
  sameState: boolean;
  sameCity: boolean;
  samePostcode: boolean;
  similarName: boolean;
}

export type VerificationDecision =
  | { status: 'VERIFIED' | 'PENDING'; checks: VerificationChecks }
  | { status: 'REJECTED'; checks: VerificationChecks };

const digits = (value?: string) => (value ?? '').replace(/\D/g, '');

/**
 * Compares the Receita Federal record with what the merchant typed.
 * - Not active (BAIXADA, SUSPENSA…) → REJECTED.
 * - Same state and city, plus the same CEP prefix or a similar name → VERIFIED.
 * - Anything else → PENDING, for an admin to look at.
 */
export function decideVerification(
  company: CompanyRecord,
  store: { name: string; address: StoreAddress },
): VerificationDecision {
  const checks: VerificationChecks = {
    active: normalizeText(company.registrationStatus) === 'ativa',
    sameState:
      Boolean(company.address.state && store.address.state) &&
      company.address.state?.toUpperCase() ===
        store.address.state?.toUpperCase(),
    sameCity:
      Boolean(company.address.city && store.address.city) &&
      normalizeText(company.address.city) === normalizeText(store.address.city),
    samePostcode:
      digits(company.address.postcode).length >= 5 &&
      digits(company.address.postcode).slice(0, 5) ===
        digits(store.address.postcode).slice(0, 5),
    similarName:
      Math.max(
        nameSimilarity(store.name, company.legalName),
        nameSimilarity(store.name, company.tradeName),
      ) >= 0.5,
  };

  if (!checks.active) return { status: 'REJECTED', checks };
  const verified =
    checks.sameState &&
    checks.sameCity &&
    (checks.samePostcode || checks.similarName);
  return { status: verified ? 'VERIFIED' : 'PENDING', checks };
}

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { isValidCnpj, normalizeCnpj } from '../common/cnpj.js';
import { ExternalServiceError } from '../integrations/http.js';
import {
  CNPJ_LOOKUP,
  type CnpjLookup,
  type CompanyRecord,
} from '../integrations/providers.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { StoreAddress } from './store.types.js';
import type { VerificationResponseDto } from './stores.dto.js';
import { StoresGeoRepository } from './stores-geo.repository.js';
import {
  decideVerification,
  type VerificationDecision,
} from './verification.rules.js';

export function parseCnpj(raw: string): string {
  const cnpj = normalizeCnpj(raw);
  if (!isValidCnpj(cnpj)) {
    throw new BadRequestException({
      code: 'INVALID_CNPJ',
      message: 'Invalid CNPJ',
    });
  }
  return cnpj;
}

/** CNPJ check against the Receita Federal (BrasilAPI). */
@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: StoresGeoRepository,
    @Inject(CNPJ_LOOKUP) private readonly lookup: CnpjLookup,
  ) {}

  /** Looks the company up and compares it with the store. Throws 422/503 with a reason. */
  async check(
    cnpj: string,
    store: { name: string; address: StoreAddress },
  ): Promise<{ company: CompanyRecord; decision: VerificationDecision }> {
    let company: CompanyRecord | null;
    try {
      company = await this.lookup.find(cnpj);
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw new ServiceUnavailableException({
          code: 'CNPJ_SERVICE_UNAVAILABLE',
          message: 'The CNPJ registry did not answer; try again later',
        });
      }
      throw error;
    }
    if (!company) {
      throw new UnprocessableEntityException({
        code: 'CNPJ_NOT_FOUND',
        message: 'CNPJ not found',
      });
    }
    const decision = decideVerification(company, store);
    if (decision.status === 'REJECTED') {
      throw new UnprocessableEntityException({
        code: 'CNPJ_NOT_ACTIVE',
        message: `CNPJ registration is ${company.registrationStatus}`,
      });
    }
    return { company, decision };
  }

  /** Verifies a store the merchant already runs, and stores the CNPJ on it. */
  async verifyStore(
    storeId: string,
    rawCnpj: string,
  ): Promise<VerificationResponseDto> {
    const cnpj = parseCnpj(rawCnpj);
    const store = await this.geo.findById(storeId);
    if (!store) throw new NotFoundException('Store not found');
    await this.assertCnpjFree(cnpj, storeId);

    const { company, decision } = await this.check(cnpj, {
      name: store.name,
      address: store.address ?? {},
    });
    await this.apply(storeId, cnpj, company, decision);
    return toResponse(company, decision);
  }

  async assertCnpjFree(cnpj: string, exceptStoreId?: string): Promise<void> {
    const owner = await this.prisma.store.findUnique({
      where: { cnpj },
      select: { id: true },
    });
    if (owner && owner.id !== exceptStoreId) {
      throw new ConflictException({
        code: 'CNPJ_TAKEN',
        message: 'Another store already uses this CNPJ; claim it instead',
        storeId: owner.id,
      });
    }
  }

  async apply(
    storeId: string,
    cnpj: string,
    company: CompanyRecord,
    decision: VerificationDecision,
  ): Promise<void> {
    if (decision.status === 'REJECTED') return;
    await this.prisma.store.update({
      where: { id: storeId },
      data: {
        cnpj,
        verificationStatus: decision.status,
        companyData: {
          legalName: company.legalName,
          tradeName: company.tradeName,
          registrationStatus: company.registrationStatus,
          address: { ...company.address },
          checks: { ...decision.checks },
          checkedAt: new Date().toISOString(),
        },
      },
    });
  }
}

export function toResponse(
  company: CompanyRecord,
  decision: VerificationDecision,
): VerificationResponseDto {
  return {
    status: decision.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
    checks: decision.checks,
    legalName: company.legalName,
    tradeName: company.tradeName,
  };
}

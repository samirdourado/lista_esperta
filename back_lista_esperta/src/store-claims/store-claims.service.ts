import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClaimStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StoresGeoRepository } from '../stores/stores-geo.repository.js';
import { toStoreResponse } from '../stores/stores.service.js';
import {
  parseCnpj,
  toResponse,
  VerificationService,
} from '../stores/verification.service.js';
import type {
  AdminStoreClaimResponseDto,
  CreateStoreClaimDto,
  CreateStoreClaimResponseDto,
  StoreClaimResponseDto,
} from './store-claims.dto.js';

/**
 * "Esta loja é minha": a merchant asks to run a store that came from the map
 * or from a receipt, instead of registering a duplicate.
 */
@Injectable()
export class StoreClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: StoresGeoRepository,
    private readonly verification: VerificationService,
  ) {}

  async create(
    userId: string,
    dto: CreateStoreClaimDto,
  ): Promise<CreateStoreClaimResponseDto> {
    const store = await this.geo.findById(dto.storeId);
    if (!store) throw new NotFoundException('Store not found');
    const member = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId: store.id, userId } },
    });
    if (member)
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'You already manage this store',
      });

    // A matching CNPJ proves the claim; anything less waits for an admin.
    if (dto.cnpj) {
      const cnpj = parseCnpj(dto.cnpj);
      await this.verification.assertCnpjFree(cnpj, store.id);
      const { company, decision } = await this.verification.check(cnpj, {
        name: store.name,
        address: store.address ?? {},
      });
      if (decision.status === 'VERIFIED' && !store.managed) {
        const claim = await this.prisma.$transaction(async (tx) => {
          await tx.storeMember.create({
            data: { storeId: store.id, userId, memberRole: 'OWNER' },
          });
          return tx.storeClaim.create({
            data: {
              storeId: store.id,
              userId,
              status: 'APPROVED',
              decidedAt: new Date(),
              message: dto.message,
            },
          });
        });
        await this.verification.apply(store.id, cnpj, company, decision);
        return {
          claim: await this.toResponse(claim.id),
          autoApproved: true,
          verification: toResponse(company, decision),
        };
      }
    }

    const pending = await this.prisma.storeClaim.findFirst({
      where: { storeId: store.id, userId, status: 'PENDING' },
    });
    const claim =
      pending ??
      (await this.prisma.storeClaim.create({
        data: { storeId: store.id, userId, message: dto.message },
      }));
    return {
      claim: await this.toResponse(claim.id),
      autoApproved: false,
      verification: null,
    };
  }

  async mine(userId: string): Promise<StoreClaimResponseDto[]> {
    const claims = await this.prisma.storeClaim.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return Promise.all(claims.map((claim) => this.toResponse(claim.id)));
  }

  // --- admin -------------------------------------------------------------

  async list(status: ClaimStatus): Promise<AdminStoreClaimResponseDto[]> {
    const claims = await this.prisma.storeClaim.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, email: true, displayName: true } },
      },
    });
    return Promise.all(
      claims.map(async (claim) => ({
        ...(await this.toResponse(claim.id)),
        user: claim.user,
      })),
    );
  }

  async decide(
    claimId: string,
    status: 'APPROVED' | 'REJECTED',
  ): Promise<StoreClaimResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      const claim = await tx.storeClaim.findUnique({ where: { id: claimId } });
      if (!claim) throw new NotFoundException('Claim not found');
      if (claim.status !== 'PENDING') {
        throw new ConflictException({
          code: 'CLAIM_DECIDED',
          message: `Claim is already ${claim.status}`,
        });
      }
      await tx.storeClaim.update({
        where: { id: claimId },
        data: { status, decidedAt: new Date() },
      });
      if (status === 'APPROVED') {
        await tx.storeMember.upsert({
          where: {
            storeId_userId: { storeId: claim.storeId, userId: claim.userId },
          },
          create: {
            storeId: claim.storeId,
            userId: claim.userId,
            memberRole: 'OWNER',
          },
          update: {},
        });
      }
    });
    return this.toResponse(claimId);
  }

  private async toResponse(claimId: string): Promise<StoreClaimResponseDto> {
    const claim = await this.prisma.storeClaim.findUniqueOrThrow({
      where: { id: claimId },
    });
    const store = await this.geo.findById(claim.storeId);
    return {
      id: claim.id,
      status: claim.status,
      message: claim.message,
      createdAt: claim.createdAt.toISOString(),
      store: toStoreResponse(store!),
    };
  }
}

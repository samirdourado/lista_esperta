import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isUUID } from 'class-validator';
import type { Request } from 'express';
import type { StoreMemberRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const STORE_ROLES_KEY = 'storeMemberRoles';
/** Narrows StoreMemberGuard to some member roles, e.g. only OWNER manages the team. */
export const StoreRoles = (...roles: StoreMemberRole[]) =>
  SetMetadata(STORE_ROLES_KEY, roles);

/**
 * Every route with `:storeId` goes through this guard: the user must be a
 * StoreMember of that store. Admins pass for moderation.
 */
@Injectable()
export class StoreMemberGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    const storeId = request.params.storeId;
    if (!user) throw new ForbiddenException();
    if (typeof storeId !== 'string' || !isUUID(storeId)) {
      throw new NotFoundException('Store not found');
    }
    if (user.role === 'ADMIN') return true;

    const membership = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId: user.id } },
      select: { memberRole: true },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this store');
    }
    const allowed = this.reflector.getAllAndOverride<
      StoreMemberRole[] | undefined
    >(STORE_ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (allowed?.length && !allowed.includes(membership.memberRole)) {
      throw new ForbiddenException('Only the store owner can do this');
    }
    return true;
  }
}

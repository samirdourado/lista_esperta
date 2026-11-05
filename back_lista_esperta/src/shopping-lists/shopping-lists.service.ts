import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type ImportShoppingListsDto,
  type ImportShoppingListsResponseDto,
  type ShoppingListItemInputDto,
  ShoppingListResponseDto,
  type UpsertShoppingListDto,
} from './shopping-lists.dto.js';

const withItems = { items: true } as const;

function itemRows(items: ShoppingListItemInputDto[]) {
  return items.map((item, position) => ({
    freeText: item.freeText,
    quantity: item.quantity ?? 1,
    productId: item.productId ?? null,
    position,
  }));
}

/**
 * Ownership rule: every query is scoped by `userId`. A list that belongs to
 * someone else is reported as not found, so ids cannot be probed.
 */
@Injectable()
export class ShoppingListsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<ShoppingListResponseDto[]> {
    const lists = await this.prisma.shoppingList.findMany({
      where: { userId },
      include: withItems,
      orderBy: { updatedAt: 'desc' },
    });
    return lists.map((list) => ShoppingListResponseDto.from(list));
  }

  async findOne(userId: string, id: string): Promise<ShoppingListResponseDto> {
    const list = await this.prisma.shoppingList.findFirst({
      where: { id, userId },
      include: withItems,
    });
    if (!list) throw new NotFoundException('Shopping list not found');
    return ShoppingListResponseDto.from(list);
  }

  async create(
    userId: string,
    dto: UpsertShoppingListDto,
  ): Promise<ShoppingListResponseDto> {
    const list = await this.prisma.shoppingList.create({
      data: {
        userId,
        name: dto.name,
        items: { create: itemRows(dto.items) },
      },
      include: withItems,
    });
    return ShoppingListResponseDto.from(list);
  }

  async replace(
    userId: string,
    id: string,
    dto: UpsertShoppingListDto,
  ): Promise<ShoppingListResponseDto> {
    const list = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.shoppingList.updateMany({
        where: { id, userId },
        data: { name: dto.name },
      });
      if (count === 0) throw new NotFoundException('Shopping list not found');
      await tx.shoppingListItem.deleteMany({ where: { listId: id } });
      await tx.shoppingListItem.createMany({
        data: itemRows(dto.items).map((row) => ({ ...row, listId: id })),
      });
      return tx.shoppingList.findUniqueOrThrow({
        where: { id },
        include: withItems,
      });
    });
    return ShoppingListResponseDto.from(list);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.shoppingList.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Shopping list not found');
  }

  /**
   * Guest → account migration, called right after sign-up or sign-in.
   * - Lists are keyed by their device id: importing the same list twice is a
   *   no-op, so the server copy (the source of truth from now on) wins.
   * - Receipts and prices sent with the device's guest id move to the account.
   */
  async importFromDevice(
    userId: string,
    dto: ImportShoppingListsDto,
  ): Promise<ImportShoppingListsResponseDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      let imported = 0;
      for (const list of dto.lists) {
        const exists = await tx.shoppingList.findUnique({
          where: { userId_clientId: { userId, clientId: list.clientId } },
          select: { id: true },
        });
        if (exists) continue;
        await tx.shoppingList.create({
          data: {
            userId,
            clientId: list.clientId,
            name: list.name,
            items: { create: itemRows(list.items) },
          },
        });
        imported += 1;
      }

      let receiptsClaimed = 0;
      let pricesClaimed = 0;
      if (dto.guestId) {
        receiptsClaimed = (
          await tx.receipt.updateMany({
            where: { guestId: dto.guestId, uploadedById: null },
            data: { uploadedById: userId },
          })
        ).count;
        pricesClaimed = (
          await tx.priceObservation.updateMany({
            where: { guestId: dto.guestId, reportedById: null },
            data: { reportedById: userId },
          })
        ).count;
      }
      return { imported, receiptsClaimed, pricesClaimed };
    });

    return { ...result, lists: await this.findAll(userId) };
  }
}

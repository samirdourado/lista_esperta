import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateMeDto } from './update-me.dto.js';
import { UserResponseDto } from './user-response.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { storeMemberships: { select: { storeId: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return UserResponseDto.from(
      user,
      user.storeMemberships.map((m) => m.storeId),
    );
  }

  async updateProfile(
    userId: string,
    dto: UpdateMeDto,
  ): Promise<UserResponseDto> {
    await this.prisma.user.update({ where: { id: userId }, data: dto });
    return this.getProfile(userId);
  }
}

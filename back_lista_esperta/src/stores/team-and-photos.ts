import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { Public, Roles } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  assertImage,
  MAX_IMAGE_BYTES,
  StorageService,
} from '../storage/storage.service.js';
import { StoreMemberGuard, StoreRoles } from './store-member.guard.js';

export const MAX_PHOTOS_PER_STORE = 10;

export class AddMemberDto {
  @ApiProperty({
    example: 'equipe@example.com',
    description: 'Must already have a merchant account',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;
}

export class StorePhotoDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'http://localhost:3333/uploads/stores/abc.jpg' })
  url: string;
}

@Injectable()
export class TeamAndPhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async addMember(storeId: string, email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });
    if (!user || user.role !== 'MERCHANT') {
      throw new NotFoundException({
        code: 'MERCHANT_NOT_FOUND',
        message: 'No merchant account with this e-mail',
      });
    }
    const exists = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId: user.id } },
    });
    if (exists)
      throw new ConflictException({
        code: 'ALREADY_MEMBER',
        message: 'Already in the team',
      });
    await this.prisma.storeMember.create({
      data: { storeId, userId: user.id, memberRole: 'STAFF' },
    });
  }

  /** The last owner cannot leave: the store would have nobody to run it. */
  async removeMember(storeId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const member = await tx.storeMember.findUnique({
        where: { storeId_userId: { storeId, userId } },
      });
      if (!member) throw new NotFoundException('Not a member of this store');
      if (member.memberRole === 'OWNER') {
        const owners = await tx.storeMember.count({
          where: { storeId, memberRole: 'OWNER' },
        });
        if (owners <= 1)
          throw new ConflictException({
            code: 'LAST_OWNER',
            message: 'The store needs at least one owner',
          });
      }
      await tx.storeMember.delete({
        where: { storeId_userId: { storeId, userId } },
      });
    });
  }

  async photos(storeId: string): Promise<StorePhotoDto[]> {
    const rows = await this.prisma.storePhoto.findMany({
      where: { storeId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      url: this.storage.publicUrl(row.storageKey),
    }));
  }

  async addPhoto(
    storeId: string,
    file: Express.Multer.File | undefined,
  ): Promise<StorePhotoDto> {
    const extension = assertImage(file);
    if (
      (await this.prisma.storePhoto.count({ where: { storeId } })) >=
      MAX_PHOTOS_PER_STORE
    ) {
      throw new BadRequestException({
        code: 'TOO_MANY_PHOTOS',
        message: `Up to ${MAX_PHOTOS_PER_STORE} photos per store`,
      });
    }
    const key = await this.storage.save(
      `stores/${storeId}`,
      file!.buffer,
      extension,
    );
    const row = await this.prisma.storePhoto.create({
      data: { storeId, storageKey: key },
    });
    return { id: row.id, url: this.storage.publicUrl(key) };
  }

  async removePhoto(storeId: string, photoId: string): Promise<void> {
    const photo = await this.prisma.storePhoto.findFirst({
      where: { id: photoId, storeId },
    });
    if (!photo) throw new NotFoundException('Photo not found');
    await this.prisma.storePhoto.delete({ where: { id: photo.id } });
    await this.storage.remove(photo.storageKey);
  }
}

@ApiTags('stores')
@Controller('stores/:storeId')
export class TeamAndPhotosController {
  constructor(private readonly service: TeamAndPhotosService) {}

  /** Store photos are public, like the store itself. */
  @Public()
  @Get('photos')
  @ApiOkResponse({ type: [StorePhotoDto] })
  photos(
    @Param('storeId', ParseUUIDPipe) storeId: string,
  ): Promise<StorePhotoDto[]> {
    return this.service.photos(storeId);
  }

  @Post('photos')
  @Roles('MERCHANT', 'ADMIN')
  @UseGuards(StoreMemberGuard)
  @ApiCookieAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: StorePhotoDto })
  addPhoto(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<StorePhotoDto> {
    return this.service.addPhoto(storeId, file);
  }

  @Delete('photos/:photoId')
  @Roles('MERCHANT', 'ADMIN')
  @UseGuards(StoreMemberGuard)
  @ApiCookieAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removePhoto(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<void> {
    return this.service.removePhoto(storeId, photoId);
  }

  /** Adds an existing merchant account to the team as STAFF. Owner only. */
  @Post('members')
  @Roles('MERCHANT', 'ADMIN')
  @UseGuards(StoreMemberGuard)
  @StoreRoles('OWNER')
  @ApiCookieAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'ALREADY_MEMBER' })
  addMember(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: AddMemberDto,
  ): Promise<void> {
    return this.service.addMember(storeId, dto.email);
  }

  @Delete('members/:userId')
  @Roles('MERCHANT', 'ADMIN')
  @UseGuards(StoreMemberGuard)
  @StoreRoles('OWNER')
  @ApiCookieAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'LAST_OWNER' })
  removeMember(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.service.removeMember(storeId, userId);
  }
}

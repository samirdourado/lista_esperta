import { Body, Controller, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators.js';
import { UpdateMeDto } from './update-me.dto.js';
import { UserResponseDto } from './user-response.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiCookieAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Updates the signed-in user's name and travel preferences. */
  @Patch('me')
  @ApiOkResponse({ type: UserResponseDto })
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMeDto,
  ): Promise<UserResponseDto> {
    return this.users.updateProfile(user.id, dto);
  }
}

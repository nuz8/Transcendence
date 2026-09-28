import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
  Patch,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UserService } from './user.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { avatarUploadOptions } from './avatar-upload.config';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  ApiUsersController,
  ApiGetUsersSelf,
  ApiPatchUsersSelf,
  ApiPostUsersAvatar,
} from './user-api.decorators'
import { PublicUserResponseDto } from './dto/public-user-response.dto';

@ApiUsersController()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('self')
  @ApiGetUsersSelf()
  @UseGuards(AuthGuard)
  async getSelf(
    @Req() req: any
  ): Promise<PublicUserResponseDto> {
    const user = await this.userService.findById(req.user.sub);

    if (!user) {
      throw new NotFoundException();
    }

    return user.toPublicData();
  }

  @Patch('self')
  @ApiPatchUsersSelf()
  @UseGuards(AuthGuard)
  async updateSelf(
    @Req() req: any, @Body() dto: UpdateProfileDto
  ): Promise<PublicUserResponseDto> {
    const user = await this.userService.updateProfile(req.user.sub, dto.username);
    return user.toPublicData();
  }

  @Post('avatar')
  @ApiPostUsersAvatar()
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  async uploadAvatar(
    @Req() req: any,
    @UploadedFile() file?: { filename: string },
  ): Promise<PublicUserResponseDto> {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }

    const updatedUser = await this.userService.updateAvatar(
      req.user.sub,
      file.filename,
    );

    return updatedUser.toPublicData();
  }
}

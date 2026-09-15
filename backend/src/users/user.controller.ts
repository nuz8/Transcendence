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
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UserService } from './user.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { avatarUploadOptions } from './avatar-upload.config';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('self')
  @UseGuards(AuthGuard)
  async getSelf(@Req() req: any) {
    const user = await this.userService.findById(req.user.sub);

    if (!user) {
      throw new NotFoundException();
    }

    return user.toPublicData();
  }

  @Post('avatar')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  async uploadAvatar(
    @Req() req: any,
    @UploadedFile() file?: { filename: string },
  ) {
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

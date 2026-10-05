import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/guards/auth.guard";
import { ProfileService } from "./profile.service";
import { MatchHistoryQueryDto } from "../scores/dto/mh-query.dto";
import { ProfileResponseDto, SelfProfileResponseDto } from "./dto/profile-response.dto";
import { ApiGetSelfProfile, ApiGetUserProfile, ApiProfileController } from "./profile-api.decorators";

interface AuthenticatedRequest {
  user: {sub: string};
}

@ApiProfileController()
@Controller('users')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('self/profile')
  @ApiGetSelfProfile()
  async getSelfProfile(
    @Req() req: AuthenticatedRequest,
    @Query() query: MatchHistoryQueryDto,
  ): Promise<SelfProfileResponseDto> {
    return this.profileService.getSelfProfile(req.user.sub, query.page, query.limit);
  }

  @Get(':id/profile')
  @ApiGetUserProfile()
  async getProfile(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: MatchHistoryQueryDto,
  ): Promise<ProfileResponseDto> {
    return this.profileService.getProfile(req.user.sub, id, query.page, query.limit);
  }
}
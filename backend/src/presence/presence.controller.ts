import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { FriendService } from '../friends';
import { PresenceService } from './presence.service';
import { ApiGetUserOnlineStatus, ApiPresenceController } from './presence-api.decorators';
import { OnlineStatusResponseDto } from './dto/online-status-response.dto';

interface AuthenticatedRequest {
	user: { sub: string };
}

@ApiPresenceController()
@Controller('users')
@UseGuards(AuthGuard)
export class PresenceController {
	constructor(
		private readonly presenceService: PresenceService,
		private readonly friendService: FriendService,
	) {}

	@Get(':id/online')
	@ApiGetUserOnlineStatus()
	async isOnline(
		@Req() req: AuthenticatedRequest,
		@Param('id', new ParseUUIDPipe()) id: string,
	): Promise<OnlineStatusResponseDto> {
		if (id !== req.user.sub && !(await this.friendService.areFriends(req.user.sub, id))) {
			throw new ForbiddenException();
		}

		return { online: this.presenceService.isOnline(id) };
	}
}

import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { FriendService } from '../friends';
import { PresenceService } from './presence.service';

interface AuthenticatedRequest {
	user: { sub: string };
}

@Controller('users')
@UseGuards(AuthGuard)
export class PresenceController {
	constructor(
		private readonly presenceService: PresenceService,
		private readonly friendService: FriendService,
	) {}

	@Get(':id/online')
	async isOnline(@Req() req: AuthenticatedRequest, @Param('id', new ParseUUIDPipe()) id: string) {
		if (id !== req.user.sub && !(await this.friendService.areFriends(req.user.sub, id))) {
			throw new ForbiddenException();
		}

		return { online: this.presenceService.isOnline(id) };
	}
}

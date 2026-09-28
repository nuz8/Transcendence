import { Controller, Post, Get, Delete, Body, Param, Req, UseGuards, HttpCode, HttpStatus, BadRequestException, NotFoundException, ForbiddenException, ConflictException, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { FriendService } from './friend.service';
import { SendFriendRequestDto } from './dto/friend-request.dto';
import {
	ApiFriendsController,
	ApiPostFriendRequest,
	ApiPostAcceptFriendRequest,
	ApiPostDeclineFriendRequest,
	ApiGetFriends,
	ApiGetPendingFriendRequests,
	ApiGetOutgoingFriendRequests,
	ApiDeleteFriend,
} from './friend-api.decorators';
import { FriendshipResponseDto } from './dto/friendship-response.dto';
import { AcceptedFriendResponseDto } from './dto/accepted-friend-response.dto';
import { FriendActionResponseDto } from './dto/friend-action-response.dto';

interface AuthenticatedRequest {
	user: { sub: string };
}

@ApiFriendsController()
@Controller('friends')
@UseGuards(AuthGuard)
export class FriendController {
	constructor(private readonly friendService: FriendService) {}

	@Post()
	@ApiPostFriendRequest()
	async sendRequest(
		@Req() req: AuthenticatedRequest,
		@Body() dto: SendFriendRequestDto,
	): Promise<FriendshipResponseDto> {
		const result = await this.friendService.sendRequest(req.user.sub, dto.addresseeId);

		if (!result.success) {
			if (result.reason === 'CANNOT_FRIEND_YOURSELF') throw new BadRequestException(result.reason);
			if (result.reason === 'TARGET_USER_NOT_FOUND') throw new NotFoundException(result.reason);
			throw new ConflictException(result.reason);
		}

		return result.friendship;
	}

	@Post(':id/accept')
	@ApiPostAcceptFriendRequest()
	@HttpCode(HttpStatus.OK)
	async accept(
		@Req() req: AuthenticatedRequest,
		@Param('id', new ParseUUIDPipe()) id: string,
	): Promise<FriendshipResponseDto> {
		const result = await this.friendService.acceptRequest(req.user.sub, id);

		if (!result.success) {
			if (result.reason === 'FRIENDSHIP_NOT_FOUND') throw new NotFoundException(result.reason);
			if (result.reason === 'NOT_ALLOWED_ON_THIS_FRIENDSHIP') throw new ForbiddenException(result.reason);
			throw new ConflictException(result.reason);
		}

		return result.friendship;
	}

	@Post(':id/decline')
	@ApiPostDeclineFriendRequest()
	@HttpCode(HttpStatus.OK)
	async decline(
		@Req() req: AuthenticatedRequest,
		@Param('id', new ParseUUIDPipe()) id: string,
	): Promise<FriendshipResponseDto> {
		const result = await this.friendService.declineRequest(req.user.sub, id);

		if (!result.success) {
			if (result.reason === 'FRIENDSHIP_NOT_FOUND') throw new NotFoundException(result.reason);
			if (result.reason === 'NOT_ALLOWED_ON_THIS_FRIENDSHIP') throw new ForbiddenException(result.reason);
			throw new ConflictException(result.reason);
		}

		return result.friendship;
	}

	@Get()
	@ApiGetFriends()
	async listFriends(
		@Req() req: AuthenticatedRequest
	): Promise<AcceptedFriendResponseDto[]> {
		return this.friendService.listFriends(req.user.sub);
	}

	@Get('pending')
	@ApiGetPendingFriendRequests()
	async listPending(
		@Req() req: AuthenticatedRequest
	): Promise<FriendshipResponseDto[]> {
		return this.friendService.listPendingRequests(req.user.sub);
	}

	@Get('pending/outgoing')
	@ApiGetOutgoingFriendRequests()
	async listOutgoingPending(
		@Req() req: AuthenticatedRequest
	): Promise<FriendshipResponseDto[]> {
		return this.friendService.listOutgoingPendingRequests(req.user.sub);
	}

	@Delete(':id')
	@ApiDeleteFriend()
	@HttpCode(HttpStatus.OK)
	async remove(
		@Req() req: AuthenticatedRequest,
		@Param('id', new ParseUUIDPipe()) id: string,
	): Promise<FriendActionResponseDto> {
		const result = await this.friendService.removeFriend(req.user.sub, id);

		if (!result.success) {
			if (result.reason === 'NOT_ALLOWED_ON_THIS_FRIENDSHIP') throw new ForbiddenException(result.reason);
			throw new NotFoundException(result.reason);
		}

		return { success: true };
	}

}

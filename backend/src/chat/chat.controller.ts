import { Controller, Get, Param, Req, UseGuards, ForbiddenException, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ChatService } from './chat.service';

interface AuthenticatedRequest {
	user: { sub: string };
}

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
	constructor(private readonly chatService: ChatService) {}

	@Get(':peerId')
	async getConversation(@Req() req: AuthenticatedRequest, @Param('peerId', new ParseUUIDPipe()) peerId: string) {
		const conversation = await this.chatService.listConversation(req.user.sub, peerId);

		if (!conversation) {
			throw new ForbiddenException('NOT_FRIENDS');
		}

		return conversation;
	}
}

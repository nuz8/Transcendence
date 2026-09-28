import { Controller, Get, Param, Req, UseGuards, ForbiddenException, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ChatService } from './chat.service';
import { ApiChatController, ApiGetChatPeer } from './chat-api.decorators';
import { MessageResponseDto } from './dto/message-response.dto';

interface AuthenticatedRequest {
	user: { sub: string };
}

@ApiChatController()
@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
	constructor(private readonly chatService: ChatService) {}

	@Get(':peerId')
	@ApiGetChatPeer()
	async getConversation(
		@Req() req: AuthenticatedRequest,
		@Param('peerId', new ParseUUIDPipe()) peerId: string
	): Promise<MessageResponseDto[]> {
		const conversation = await this.chatService.listConversation(req.user.sub, peerId);

		if (!conversation) {
			throw new ForbiddenException('NOT_FRIENDS');
		}

		return conversation;
	}
}

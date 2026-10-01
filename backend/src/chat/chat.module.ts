import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FriendModule } from '../friends/friend.module';
import { UserModule } from '../users';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';
import { PresenceModule } from '../presence/presence.module';

@Module({
	imports: [AuthModule, FriendModule, UserModule, PresenceModule],
	controllers: [ChatController],
	providers: [ChatRepository, ChatService, ChatGateway],
})
export class ChatModule {}

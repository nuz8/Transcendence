import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FriendModule } from '../friends/friend.module';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';

@Module({
	imports: [AuthModule, FriendModule],
	controllers: [PresenceController],
	providers: [PresenceService],
	exports: [PresenceService],
})
export class PresenceModule {}

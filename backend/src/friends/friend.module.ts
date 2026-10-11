import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../users';
import { FriendController } from './friend.controller';
import { FriendRepository } from './friend.repository';
import { FriendService } from './friend.service';
import { ApiKeyModule } from '../api-keys';

@Module({
	imports: [AuthModule, UserModule, ApiKeyModule],
	controllers: [FriendController],
	providers: [FriendRepository, FriendService],
	exports: [FriendService],
})
export class FriendModule {}

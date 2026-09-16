import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../users';
import { FriendController } from './friend.controller';
import { FriendRepository } from './friend.repository';
import { FriendService } from './friend.service';

@Module({
	imports: [AuthModule, UserModule],
	controllers: [FriendController],
	providers: [FriendRepository, FriendService],
})
export class FriendModule {}

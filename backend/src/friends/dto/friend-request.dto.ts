import { IsUUID } from 'class-validator';

export class SendFriendRequestDto {
	@IsUUID('4', { message: 'addresseeId must be a valid UUID' })
	addresseeId!: string;
}

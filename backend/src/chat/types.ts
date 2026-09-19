import { MessageEntity } from './message.entity';

export type SendMessageResult =
	| { success: true; message: MessageEntity }
	| { success: false; reason: 'CANNOT_MESSAGE_YOURSELF' | 'NOT_FRIENDS' | 'TARGET_USER_NOT_FOUND' };

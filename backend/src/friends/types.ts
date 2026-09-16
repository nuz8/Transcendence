import { FriendshipEntity } from './friend.entity';

export type SendFriendRequestResult =
	| { success: true; friendship: FriendshipEntity }
	| { success: false; reason: 'CANNOT_FRIEND_YOURSELF' | 'ALREADY_PENDING' | 'ALREADY_FRIENDS' | 'TARGET_USER_NOT_FOUND' };

export type RespondToFriendRequestResult =
	| { success: true; friendship: FriendshipEntity }
	| { success: false; reason: 'FRIENDSHIP_NOT_FOUND' | 'NOT_ALLOWED_ON_THIS_FRIENDSHIP' | 'FRIENDSHIP_NOT_PENDING' };

export type RemoveFriendResult =
	| { success: true }
	| { success: false; reason: 'FRIENDSHIP_NOT_FOUND' | 'NOT_ALLOWED_ON_THIS_FRIENDSHIP' };

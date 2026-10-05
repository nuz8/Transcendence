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

export const FRIENDSHIP_STATES = [
    'self',
    'none',
    'friends',
    'pending_outgoing',
    'pending_incoming',
] as const;

export type FriendshipState = (typeof FRIENDSHIP_STATES)[number];

export type FriendshipRelationship = {
	state: FriendshipState;
	friendshipId: string | null;
};
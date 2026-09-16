export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export type FriendshipAttributes = {
	id: string;
	requesterId: string;
	addresseeId: string;
	status: FriendshipStatus;
	createdAt: Date;
	respondedAt: Date | null;
};

export class FriendshipEntity {
	id: string;
	requesterId: string;
	addresseeId: string;
	status: FriendshipStatus;
	createdAt: Date;
	respondedAt: Date | null;

	constructor(attrs: FriendshipAttributes) {
		this.id = attrs.id;
		this.requesterId = attrs.requesterId;
		this.addresseeId = attrs.addresseeId;
		this.status = attrs.status;
		this.createdAt = attrs.createdAt;
		this.respondedAt = attrs.respondedAt;
	}
}

export type AcceptedFriend = {
	friendshipId: string;
	status: FriendshipStatus;
	createdAt: Date;
	friend: {
		id: string;
		username: string;
		avatar: string;
	};
};

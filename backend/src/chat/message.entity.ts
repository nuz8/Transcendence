export type MessageAttributes = {
	id: string;
	senderId: string;
	receiverId: string;
	content: string;
	createdAt: Date;
};

export class MessageEntity {
	id: string;
	senderId: string;
	receiverId: string;
	content: string;
	createdAt: Date;

	constructor(attrs: MessageAttributes) {
		this.id = attrs.id;
		this.senderId = attrs.senderId;
		this.receiverId = attrs.receiverId;
		this.content = attrs.content;
		this.createdAt = attrs.createdAt;
	}
}

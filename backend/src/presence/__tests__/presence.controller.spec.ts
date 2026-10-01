import { ForbiddenException } from '@nestjs/common';
import { PresenceController } from '../presence.controller';
import { PresenceService } from '../presence.service';
import { FriendService } from '../../friends';

function fakeRequest(sub: string) {
	return { user: { sub } };
}

describe('PresenceController', () => {
	let presenceService: PresenceService;
	let friendService: FriendService;
	let controller: PresenceController;

	beforeEach(() => {
		presenceService = new PresenceService();
		friendService = { areFriends: jest.fn() } as unknown as FriendService;
		controller = new PresenceController(presenceService, friendService);
	});

	it("returns the caller's own online status without checking friendship", async () => {
		presenceService.connect('caller-1', {});

		const result = await controller.isOnline(fakeRequest('caller-1'), 'caller-1');

		expect(result).toEqual({ online: true });
		expect(friendService.areFriends).not.toHaveBeenCalled();
	});

	it("returns a friend's online status", async () => {
		(friendService.areFriends as jest.Mock).mockResolvedValue(true);
		presenceService.connect('friend-1', {});

		const result = await controller.isOnline(fakeRequest('caller-1'), 'friend-1');

		expect(result).toEqual({ online: true });
		expect(friendService.areFriends).toHaveBeenCalledWith('caller-1', 'friend-1');
	});

	it('rejects a target who is neither self nor a friend', async () => {
		(friendService.areFriends as jest.Mock).mockResolvedValue(false);

		await expect(controller.isOnline(fakeRequest('caller-1'), 'stranger-1')).rejects.toThrow(ForbiddenException);
	});
});

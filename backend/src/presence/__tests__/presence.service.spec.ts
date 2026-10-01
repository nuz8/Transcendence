import { PresenceService } from '../presence.service';

describe('PresenceService', () => {
	const presence = new PresenceService();

	it('is not online with no connection', () => {
		expect(presence.isOnline('user-1')).toBe(false);
	});

	it('is online once a connection is registered', () => {
		presence.connect('user-1', {});
		expect(presence.isOnline('user-1')).toBe(true);
	});

	it('stays online while at least one connection remains (multi-socket)', () => {
		const refA = {};
		const refB = {};
		presence.connect('user-2', refA);
		presence.connect('user-2', refB);

		presence.disconnect('user-2', refA);
		expect(presence.isOnline('user-2')).toBe(true);

		presence.disconnect('user-2', refB);
		expect(presence.isOnline('user-2')).toBe(false);
	});

	it('disconnecting an unregistered ref for an unknown user is a no-op', () => {
		expect(() => presence.disconnect('never-connected', {})).not.toThrow();
		expect(presence.isOnline('never-connected')).toBe(false);
	});

	it('tracks users independently', () => {
		presence.connect('user-3', {});
		expect(presence.isOnline('user-3')).toBe(true);
		expect(presence.isOnline('user-4')).toBe(false);
	});
});


describe('PresenceService - change events', () => {
  let presence: PresenceService;
  let onChange: jest.Mock;

  beforeEach(() => {
    presence = new PresenceService();
    onChange = jest.fn();
    presence.onChange(onChange);
  });

  it('emits a change when a user goes online for the first time', () => {
    presence.connect('user-1', {});

    expect(onChange).toHaveBeenCalledWith({ userId: 'user-1', online: true });
  });

  it('does not emit again for an additional socket of an already-online user', () => {
    presence.connect('user-1', {});
    onChange.mockClear();

    presence.connect('user-1', {});

    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits a change when the last socket disconnects', () => {
    const ref = {};
    presence.connect('user-1', ref);
    onChange.mockClear();

    presence.disconnect('user-1', ref);

    expect(onChange).toHaveBeenCalledWith({ userId: 'user-1', online: false });
  });

  it('does not emit while another socket keeps the user online', () => {
    const refA = {};
    const refB = {};
    presence.connect('user-1', refA);
    presence.connect('user-1', refB);
    onChange.mockClear();

    presence.disconnect('user-1', refA);

    expect(onChange).not.toHaveBeenCalled();
  });
});

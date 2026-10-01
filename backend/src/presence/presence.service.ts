import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export interface PresenceChange {
	userId: string;
	online: boolean;
}

@Injectable()
export class PresenceService {
	private readonly connections = new Map<string, Set<object>>();
	private readonly events = new EventEmitter();

	connect(userId: string, ref: object): void {
		const wasOnline = this.isOnline(userId);
		const existing = this.connections.get(userId);
		if (existing) {
			existing.add(ref);
		} else {
			this.connections.set(userId, new Set([ref]));
		}
		if (!wasOnline) this.emitChange(userId, true);
	}

	disconnect(userId: string, ref: object): void {
		const existing = this.connections.get(userId);
		if (!existing) return;

		existing.delete(ref);
		if (existing.size === 0) {
			this.connections.delete(userId);
			this.emitChange(userId, false);
		}
	}

	isOnline(userId: string): boolean {
		return this.connections.has(userId);
	}

	onChange(listener: (change: PresenceChange) => void): void {
		this.events.on('change', listener);
	}

	private emitChange(userId: string, online: boolean): void {
		this.events.emit('change', { userId, online });
	}
}
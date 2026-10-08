import { WebSocket } from 'ws';
import type { MatchMode } from '../match/match.types';

const MATCH_LEVEL_RANGE = 2;
const WIDEN_AFTER_MS = 15_000;
const SWEEP_INTERVAL_MS = 5_000;

export type MatchSettings = { target: number; mode: MatchMode; powerUps: boolean };
export type Queued = { client: WebSocket; userId: string };
type Waiter = Queued & { settings: MatchSettings; level: number; since: number };
type Pair = (settings: MatchSettings, first: Queued, second: Queued) => void;

export class MatchQueue {
    private readonly waiting = new Map<string, Waiter[]>();
    private sweep: NodeJS.Timeout | null = null;

    constructor(private readonly pair: Pair) {}

    start(): void {
        this.sweep = setInterval(() => this.widen(), SWEEP_INTERVAL_MS);
    }

    stop(): void {
        if (this.sweep)
            clearInterval(this.sweep);
        this.sweep = null;
    }

    has(userId: string): boolean {
        for (const slot of this.waiting.values())
            if (slot.some((waiter) => waiter.userId === userId))
                return true;
        return false;
    }

    join(player: Queued, settings: MatchSettings, level: number): boolean {
        const key = `${settings.mode}:${settings.target}:${settings.powerUps}`;
        const slot = this.waiting.get(key) ?? [];
        const opponent = this.closest(slot, level, MATCH_LEVEL_RANGE);
        if (!opponent) {
            slot.push({ ...player, settings, level, since: Date.now() });
            this.waiting.set(key, slot);
            return false;
        }
        this.remove(key, opponent);
        this.pair(settings, opponent, player);
        return true;
    }

    leave(client: WebSocket): string | undefined {
        for (const [key, slot] of this.waiting) {
            const waiter = slot.find((w) => w.client === client);
            if (waiter) {
                this.remove(key, waiter);
                return waiter.userId;
            }
        }
        return undefined;
    }

    private widen(): void {
        const now = Date.now();
        for (const [key, slot] of this.waiting) {
            for (const waiter of [...slot]) {
                if (!slot.includes(waiter) || now - waiter.since < WIDEN_AFTER_MS)
                    continue ;
                const opponent = this.closest(slot.filter((w) => w !== waiter), waiter.level, Infinity);
                if (!opponent)
                    continue ;
                this.remove(key, waiter);
                this.remove(key, opponent);
                this.pair(waiter.settings, opponent, waiter);
            }
        }
    }

    private closest(slot: Waiter[], level: number, maxGap: number): Waiter | undefined {
        let closest: Waiter | undefined;
        for (const waiter of slot) {
            const gap = Math.abs(waiter.level - level);
            if (gap <= maxGap && (!closest || gap < Math.abs(closest.level - level)))
                closest = waiter;
        }
        return closest;
    }

    private remove(key: string, waiter: Waiter): void {
        const slot = this.waiting.get(key);
        if (!slot)
            return ;
        slot.splice(slot.indexOf(waiter), 1);
        if (slot.length === 0)
            this.waiting.delete(key);
    }
}

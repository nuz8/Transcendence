import { Injectable } from "@nestjs/common";

type Busy = { gameId: string; sessionId?: string };

@Injectable()
export class ActiveMatchService {
    private readonly busy = new Map<string, Busy>();

    isBusy(userId: string): boolean {
        return this.busy.has(userId);
    }

    whereBusy(userId: string): Busy | undefined {
        return this.busy.get(userId);
    }

    add(userId: string, gameId: string, sessionId?: string): void {
        this.busy.set(userId, { gameId, sessionId });
    }

    remove(userId: string): void {
        this.busy.delete(userId);
    }
}
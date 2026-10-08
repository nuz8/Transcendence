export class RoundClock {
    private timer: NodeJS.Timeout | null = null;
    private endsAt: number | null = null;   // while it runs
    private left: number | null = null; //while it runs

    constructor(private readonly onExpire: () => void) {}

    reset(ms: number): void {
        this.stop();
        this.left = ms;
    }

    pause(): void {
        if (!this.timer || this.endsAt === null)
            return ;
        clearTimeout(this.timer);
        this.timer = null;
        this.left = Math.max(0, this.endsAt - Date.now());
        this.endsAt = null;
    }

    resume(): void {
        if (this.left === null || this.timer)
            return ;
        const ms = this.left;
        this.left = null;
        this.endsAt = Date.now() + ms;
        this.timer = setTimeout(() => {
            this.stop();
            this.onExpire();
        }, ms);
    }

    stop(): void {
        if (this.timer)
            clearTimeout(this.timer);
        this.timer = null;
        this.endsAt = null;
        this.left = null;
    }

    timeLeft(): number | null {
        if (this.endsAt !== null)
            return Math.max(0, this.endsAt - Date.now());
        return this.left;
    }
}

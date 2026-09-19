export class AllowList {
  private readonly valid = new Map<string, number>();

  add(jti: string, expiresAt: number): void {
    this.valid.set(jti, expiresAt);
    this.cleanupExpired();
  }

  isValid(jti: string): boolean {
    const expiresAt = this.valid.get(jti);
    if (expiresAt === undefined) {
      return false;
    }
    if (Date.now() >= expiresAt) {
      this.valid.delete(jti);
      return false;
    }
    return true;
  }

  remove(jti: string): void {
    this.valid.delete(jti);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [jti, expiresAt] of this.valid) {
      if (now >= expiresAt) {
        this.valid.delete(jti);
      }
    }
  }
}

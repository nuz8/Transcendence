export class DenyList {
  private readonly revoked = new Map<string, number>();

  revoke(jti: string, expiresAt: number): void {
    this.revoked.set(jti, expiresAt);
    this.cleanupExpired();
  }

  isRevoked(jti: string): boolean {
    const expiresAt = this.revoked.get(jti);
    if (expiresAt === undefined) {
      return false;
    }
    if (Date.now() >= expiresAt) {
      this.revoked.delete(jti);
      return false;
    }
    return true;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [jti, expiresAt] of this.revoked) {
      if (now >= expiresAt) {
        this.revoked.delete(jti);
      }
    }
  }
}

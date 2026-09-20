import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from './client';
import { users, games, scores } from './schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

// A valid 60-character bcrypt hash for testing valid insertions
const VALID_BCRYPT_HASH =
  '$2b$12$e80yq9O8r.xXpY4Ew9KjSeB4dO6p8q7a5d3f2g1h0j9k8l7m6n5o4';

async function expectConstraintViolation(
  promise: Promise<unknown>,
  constraintName: string,
) {
  try {
    await promise;
    throw new Error(
      `Expected query to fail with constraint "${constraintName}", but it succeeded.`,
    );
  } catch (err: any) {
    const constraint = err?.cause?.constraint;
    const message = `${err?.message ?? ''} ${err?.cause?.message ?? ''}`;
    if (constraint !== constraintName && !message.includes(constraintName)) {
      throw err;
    }
  }
}

describe('Database Schema Constraints', () => {
  // Clean up any test records after the test suite finishes
  afterAll(async () => {
    await (db.$client as any).end();
  });

  describe('users table constraints', () => {
    it('accepts a valid user', async () => {
      const [inserted] = await db
        .insert(users)
        .values({
          username: 'valid_user',
          email: 'valid_user@example.com',
          passwordHash: VALID_BCRYPT_HASH,
        })
        .returning();

      expect(inserted).toBeDefined();
      expect(inserted.username).toBe('valid_user');

      // Cleanup
      await db.delete(users).where(eq(users.id, inserted.id));
    });

    describe('users_username_length check', () => {
      it('rejects username shorter than 3 characters', async () => {
        await expectConstraintViolation(
          db.insert(users).values({
            username: 'ab',
            email: 'short_user@example.com',
            passwordHash: VALID_BCRYPT_HASH,
          }),
          'users_username_length',
        );
      });

      it('rejects username with leading or trailing whitespace', async () => {
        await expectConstraintViolation(
          db.insert(users).values({
            username: ' bob ',
            email: 'spaces_user@example.com',
            passwordHash: VALID_BCRYPT_HASH,
          }),
          'users_username_length',
        );
      });

      it('rejects username longer than 32 characters', async () => {
        await expectConstraintViolation(
          db.insert(users).values({
            username: 'a'.repeat(33),
            email: 'long_user@example.com',
            passwordHash: VALID_BCRYPT_HASH,
          }),
          'users_username_length',
        );
      });
    });

    describe('users_email_format check', () => {
      it('rejects email without an @ symbol', async () => {
        await expectConstraintViolation(
          db.insert(users).values({
            username: 'bad_email_user1',
            email: 'notanemail.com',
            passwordHash: VALID_BCRYPT_HASH,
          }),
          'users_email_format',
        );
      });

      it('rejects email without a domain', async () => {
        await expectConstraintViolation(
          db.insert(users).values({
            username: 'bad_email_user2',
            email: 'test@nodomain',
            passwordHash: VALID_BCRYPT_HASH,
          }),
          'users_email_format',
        );
      });

      it('rejects email containing spaces', async () => {
        await expectConstraintViolation(
          db.insert(users).values({
            username: 'bad_email_user3',
            email: ' test@example.com ',
            passwordHash: VALID_BCRYPT_HASH,
          }),
          'users_email_format',
        );
      });
    });

    describe('users_email_max_length check', () => {
      it('rejects email longer than 254 characters', async () => {
        // e.g. 243 'a's + '@example.com' (12 chars) = 255 chars
        const longEmail = `${'a'.repeat(243)}@example.com`;
        await expectConstraintViolation(
          db.insert(users).values({
            username: 'long_email_user',
            email: longEmail,
            passwordHash: VALID_BCRYPT_HASH,
          }),
          'users_email_max_length',
        );
      });
    });

    describe('users_password_hash_bcrypt check', () => {
      it('rejects plaintext password', async () => {
        await expectConstraintViolation(
          db.insert(users).values({
            username: 'plain_pass_user',
            email: 'plain@example.com',
            passwordHash: 'myPlaintextPassword123!',
          }),
          'users_password_hash_bcrypt',
        );
      });

      it('rejects malformed or truncated bcrypt hash', async () => {
        await expectConstraintViolation(
          db.insert(users).values({
            username: 'malformed_hash_user',
            email: 'malformed@example.com',
            passwordHash: '$2b$12$shortHashThatIsNot60Chars',
          }),
          'users_password_hash_bcrypt',
        );
      });
    });
  });

  describe('games table constraints', () => {
    it('accepts a valid game', async () => {
      const [inserted] = await db
        .insert(games)
        .values({ name: 'Pong' })
        .returning();

      expect(inserted).toBeDefined();
      expect(inserted.name).toBe('Pong');

      await db.delete(games).where(eq(games.id, inserted.id));
    });

    describe('games_name_length check', () => {
      it('rejects empty string game name', async () => {
        await expectConstraintViolation(
          db.insert(games).values({ name: '' }),
          'games_name_length',
        );
      });

      it('rejects game name with only whitespace or leading/trailing whitespace', async () => {
        await expectConstraintViolation(
          db.insert(games).values({ name: '   ' }),
          'games_name_length',
        );

        await expectConstraintViolation(
          db.insert(games).values({ name: ' Pong ' }),
          'games_name_length',
        );
      });

      it('rejects game name exceeding 64 characters', async () => {
        await expectConstraintViolation(
          db.insert(games).values({ name: 'G'.repeat(65) }),
          'games_name_length',
        );
      });
    });
  });

  describe('scores table constraints', () => {
    let testUserId: string;
    let testGameId: string;

    beforeAll(async () => {
      const [user] = await db
        .insert(users)
        .values({
          username: 'scores_tester',
          email: 'scores_tester@example.com',
          passwordHash: VALID_BCRYPT_HASH,
        })
        .returning();
      testUserId = user.id;

      const [game] = await db
        .insert(games)
        .values({ name: 'Test Score Game' })
        .returning();
      testGameId = game.id;
    });

    afterAll(async () => {
      if (testUserId) await db.delete(users).where(eq(users.id, testUserId));
      if (testGameId) await db.delete(games).where(eq(games.id, testGameId));
    });

    describe('scores_value_non_negative check', () => {
      it('accepts a score with a non-negative value (0 or higher)', async () => {
        const [score] = await db
          .insert(scores)
          .values({
            sessionId: randomUUID(),
            userId: testUserId,
            gameId: testGameId,
            outcome: 'win',
            value: 42,
          })
          .returning();

        expect(score.value).toBe(42);
        await db.delete(scores).where(eq(scores.sessionId, score.sessionId));
      });

      it('accepts a score with null value (e.g. outcome-only games like RPS)', async () => {
        const [score] = await db
          .insert(scores)
          .values({
            sessionId: randomUUID(),
            userId: testUserId,
            gameId: testGameId,
            outcome: 'draw',
            value: null,
          })
          .returning();

        expect(score.value).toBeNull();
        await db.delete(scores).where(eq(scores.sessionId, score.sessionId));
      });

      it('rejects negative score value', async () => {
        await expectConstraintViolation(
          db.insert(scores).values({
            sessionId: randomUUID(),
            userId: testUserId,
            gameId: testGameId,
            outcome: 'lose',
            value: -1,
          }),
          'scores_value_non_negative',
        );
      });
    });
  });
});
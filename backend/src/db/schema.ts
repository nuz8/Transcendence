import {
	pgTable,
	pgEnum,
	uuid,
	text,
	integer,
	timestamp,
	uniqueIndex,
	check,
} from "drizzle-orm/pg-core";

import { relations, sql } from "drizzle-orm";

export const outcomeEnum = pgEnum("outcome", [
	"win",
	"lose",
	"draw",
	"forfeit",
]);

export const users = pgTable(
	"users",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		username: text("username").notNull(),
		email: text("email").notNull(),
		passwordHash: text("password_hash").notNull(),
		deletedAt: timestamp("deleted_at", {withTimezone: true}),
	},
	(table) => [
		uniqueIndex("users_username_active_unique")
		.on(table.username)
		.where(sql`${table.deletedAt} IS NULL`),
		// Case-sensitive uniqueness, but email case is lowered already in the DTO
		uniqueIndex("users_email_active_unique")
		.on(table.email)
		.where(sql`${table.deletedAt} IS NULL`),
		check(
			"users_username_length",
			sql`${table.username} = trim(${table.username})
				AND length(${table.username}) >= 3
				AND length(${table.username}) <= 32`,
		),
		check(
			"users_email_format",
			sql`${table.email} ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'`,
		),
		check(
			"users_email_max_length",
			sql`length(${table.email}) <= 254`,
		),
		check(
			"users_password_hash_bcrypt",
			sql`${table.passwordHash} ~ '^\\$2[aby]\\$[0-9]{2}\\$[A-Za-z0-9./]{53}$'`,
		)
	],
);

export const games = pgTable(
	"games",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		name: text("name").notNull(),
		deletedAt: timestamp("deleted_at", {withTimezone: true}),
	},
	(table) => [
		uniqueIndex("games_name_active_unique")
		.on(table.name)
		.where(sql`${table.deletedAt} IS NULL`),
		check("games_name_length",
			sql`${table.name} = trim(${table.name})
				AND length(${table.name}) >= 1
				AND length(${table.name}) <= 64`,
		)
	],
);

export const scores = pgTable(
	"scores",
	{
	sessionId: uuid("session_id").defaultRandom().primaryKey(),
	userId: uuid("user_id").notNull()
		.references(() => users.id),
	gameId: uuid("game_id").notNull()
		.references(() => games.id),
	value: integer("value"),
	outcome: outcomeEnum("outcome").notNull(),
	achievedAt: timestamp("achieved_at", { withTimezone: true })
		.notNull().defaultNow(),
	},
	(table) => [
		check(
			"scores_value_non_negative",
			sql`${table.value} IS NULL OR ${table.value} >= 0`,
		),
	],
);

export const usersRelations = relations(users, ({ many }) => ({
	scores: many(scores),
}));

export const gamesRelations = relations(games, ({ many }) => ({
	scores: many(scores),
}));

export const scoresRelations = relations(scores, ({ one }) => ({
	user: one(users, {
		fields: [scores.userId],
		references: [users.id],
	}),
	game: one(games, {
		fields: [scores.gameId],
		references: [games.id],
	}),
}));

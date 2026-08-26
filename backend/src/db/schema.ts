import {
	pgTable,
	pgEnum,
	uuid,
	text,
	integer,
	timestamp,
	uniqueIndex,
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
		uniqueIndex("users_email_active_unique")
		.on(table.email)
		.where(sql`${table.deletedAt} IS NULL`),
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

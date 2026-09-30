import {
	pgTable,
	pgEnum,
	uuid,
	text,
	integer,
	timestamp,
	uniqueIndex,
	index,
	check,
	primaryKey,
} from "drizzle-orm/pg-core";

import { relations, sql } from "drizzle-orm";
import { MATCH_MODES } from "../games/match/match.types";
import { BEST_OF_OPTIONS } from "../games/settings/game-settings.constants";

export const outcomeEnum = pgEnum("outcome", [
	"win",
	"lose",
	"draw",
	"forfeit",
]);

export const matchModeEnum = pgEnum("match_mode", MATCH_MODES);

export const  gameSettings = pgTable(
	"game_settings",
	{
		userId: uuid("user_id").notNull().references(() => users.id),
		gameId: uuid("game_id").notNull().references(() => games.id),
		bestOf: integer("best_of").notNull(),
		mode: matchModeEnum("mode").notNull().default("first-to"),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.gameId] }),
		check(
			"game_settings_best_of_allowed",
			sql`${table.bestOf} IN (${sql.raw(BEST_OF_OPTIONS.join(", "))})`,
		),
	],
);

export const users = pgTable(
	"users",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		username: text("username").notNull(),
		email: text("email").notNull(),
		passwordHash: text("password_hash").notNull(),
		avatar: text("avatar").notNull().default('/static/avatars/default.svg'),
		xp: integer("xp").notNull().default(0),
		deletedAt: timestamp("deleted_at", {withTimezone: true}),
	},
	(table) => [
		uniqueIndex("users_username_active_unique")
		.on(table.username)
		.where(sql`${table.deletedAt} IS NULL`),
		uniqueIndex("users_email_active_unique")
		.on(table.email)
		.where(sql`${table.deletedAt} IS NULL`),
		index("users_leaderboard_idx")
			.on(table.xp.desc(), table.username.asc())
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
	sessionId: uuid("session_id").notNull(),
	userId: uuid("user_id").notNull()
		.references(() => users.id),
	opponentId: uuid("opponent_id")
		.references(() => users.id),
	gameId: uuid("game_id").notNull()
		.references(() => games.id),
	value: integer("value"),
	outcome: outcomeEnum("outcome").notNull(),
	achievedAt: timestamp("achieved_at", { withTimezone: true })
		.notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.sessionId, table.userId] }),
		index("scores_user_outcome_index").on(table.userId, table.outcome),
		index("scores_pvp_wins_by_user_idx")
			.on(table.userId)
			.where(sql`${table.outcome} = 'win' AND ${table.opponentId} IS NOT NULL`),
		check(
			"scores_value_non_negative",
			sql`${table.value} IS NULL OR ${table.value} >= 0`,
		),
		check(
			"scores_opponent_not_self",
			sql`${table.opponentId} IS NULL OR ${table.opponentId} <> ${table.userId}`,
		),
	],
);

export const usersRelations = relations(users, ({ many }) => ({
	scores: many(scores),
	userAchievements: many(userAchievements),
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

export const friendStatusEnum = pgEnum("friend_status", ["pending", "accepted", "declined"]);

export const friendships = pgTable(
	"friendships",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		requesterId: uuid("requester_id").notNull().references(() => users.id),
		addresseeId: uuid("addressee_id").notNull().references(() => users.id),
		status: friendStatusEnum("status").notNull().default("pending"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		respondedAt: timestamp("responded_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("friendships_pair_unique").on(
			sql`LEAST(${table.requesterId}, ${table.addresseeId})`,
			sql`GREATEST(${table.requesterId}, ${table.addresseeId})`,
		),
		index("friendships_requester_status_idx").on(table.requesterId, table.status),
		index("friendships_addressee_status_idx").on(table.addresseeId, table.status),
		check(
			"friendships_no_self_friend",
			sql`${table.requesterId} <> ${table.addresseeId}`,
		),
	],
);

export const friendshipsRelations = relations(friendships, ({ one }) => ({
	requester: one(users, {
		fields: [friendships.requesterId],
		references: [users.id],
		relationName: "requester",
	}),
	addressee: one(users, {
		fields: [friendships.addresseeId],
		references: [users.id],
		relationName: "addressee",
	}),
}));

export const messages = pgTable(
	"messages",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		senderId: uuid("sender_id").notNull().references(() => users.id),
		receiverId: uuid("receiver_id").notNull().references(() => users.id),
		content: text("content").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("messages_sender_receiver_idx").on(table.senderId, table.receiverId, table.createdAt),
		index("messages_receiver_sender_idx").on(table.receiverId, table.senderId, table.createdAt),
		check(
			"messages_no_self_message",
			sql`${table.senderId} <> ${table.receiverId}`,
		),
		check(
			"messages_content_length",
			sql`length(${table.content}) >= 1 AND length(${table.content}) <= 2000`,
		),
	],
);

export const messagesRelations = relations(messages, ({ one }) => ({
	sender: one(users, {
		fields: [messages.senderId],
		references: [users.id],
		relationName: "sender",
	}),
	receiver: one(users, {
		fields: [messages.receiverId],
		references: [users.id],
		relationName: "receiver",
	}),
}));

export const achievements = pgTable(
	"achievements",
	{
		id: text("id").primaryKey(), // eg. "WIN_1", "WIN_2", etc.
		title: text("title").notNull(),
		description: text("description").notNull(),
		badgeUrl: text("badge_url").notNull(),
		targetWins: integer("target_wins").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("achievements_target_wins_unique").on(table.targetWins),
		check("achievements_target_wins_positive", sql`${table.targetWins} > 0`),
	],
);

export const userAchievements = pgTable(
	"user_achievements",
	{
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		achievementId: text("achievement_id")
			.notNull()
			.references(() => achievements.id, { onDelete: "cascade" }),
		unlockedAt: timestamp("unlocked_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.achievementId] }),
		index("user_achievements_user_id_idx").on(table.userId),
	],
);

export const achievementsRelations = relations(achievements, ({ many }) => ({
	userAchievements: many(userAchievements),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
	user: one(users, {
		fields: [userAchievements.userId],
		references: [users.id],
	}),
	achievement: one(achievements, {
		fields: [userAchievements.achievementId],
		references: [achievements.id],
	}),
}));
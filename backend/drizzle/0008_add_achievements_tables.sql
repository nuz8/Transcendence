CREATE TABLE "achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"badge_url" text NOT NULL,
	"target_wins" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "achievements_target_wins_positive" CHECK ("achievements"."target_wins" > 0)
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" uuid NOT NULL,
	"achievement_id" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievements_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "achievements_target_wins_unique" ON "achievements" USING btree ("target_wins");--> statement-breakpoint
CREATE INDEX "user_achievements_user_id_idx" ON "user_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scores_user_outcome_index" ON "scores" USING btree ("user_id","outcome");--> statement-breakpoint
CREATE INDEX "scores_pvp_wins_by_user_idx" ON "scores" USING btree ("user_id") WHERE "scores"."outcome" = 'win' AND "scores"."opponent_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "users_leaderboard_idx" ON "users" USING btree ("xp" DESC NULLS LAST,"username") WHERE "users"."deleted_at" IS NULL;
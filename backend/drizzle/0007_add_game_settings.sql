CREATE TYPE "public"."match_mode" AS ENUM('first-to', 'best-of');--> statement-breakpoint
CREATE TABLE "game_settings" (
	"user_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"best_of" integer NOT NULL,
	"mode" "match_mode" DEFAULT 'first-to' NOT NULL,
	CONSTRAINT "game_settings_user_id_game_id_pk" PRIMARY KEY("user_id","game_id"),
	CONSTRAINT "game_settings_best_of_allowed" CHECK ("game_settings"."best_of" IN (1, 3, 5, 7))
);
--> statement-breakpoint
ALTER TABLE "game_settings" ADD CONSTRAINT "game_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_settings" ADD CONSTRAINT "game_settings_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;
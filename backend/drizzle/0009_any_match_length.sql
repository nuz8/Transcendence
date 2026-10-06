ALTER TABLE "game_settings" DROP CONSTRAINT "game_settings_best_of_allowed";--> statement-breakpoint
ALTER TABLE "game_settings" RENAME COLUMN "best_of" TO "target";--> statement-breakpoint
ALTER TYPE "public"."match_mode" RENAME VALUE 'first-to' TO 'fixed-target-score';--> statement-breakpoint
ALTER TYPE "public"."match_mode" RENAME VALUE 'best-of' TO 'fixed-rounds';--> statement-breakpoint
ALTER TABLE "game_settings" ALTER COLUMN "mode" SET DEFAULT 'fixed-target-score';--> statement-breakpoint
UPDATE "game_settings" SET "target" = ("target" + 1) / 2 WHERE "mode" = 'fixed-target-score';--> statement-breakpoint
ALTER TABLE "game_settings" ADD CONSTRAINT "game_settings_target_allowed" CHECK ("game_settings"."target" IN (1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
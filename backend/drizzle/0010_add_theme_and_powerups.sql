CREATE TYPE "public"."game_theme" AS ENUM('default', 'extra');--> statement-breakpoint
ALTER TABLE "game_settings" ADD COLUMN "theme" "game_theme" DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_settings" ADD COLUMN "power_ups" boolean DEFAULT false NOT NULL;
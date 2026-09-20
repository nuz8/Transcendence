
-- ALTER TABLE "scores" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "scores" DROP CONSTRAINT "scores_pkey";--> statement-breakpoint
ALTER TABLE "scores" ALTER COLUMN "session_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_session_id_user_id_pk" PRIMARY KEY("session_id","user_id");--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "opponent_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_opponent_id_users_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_opponent_not_self" CHECK ("scores"."opponent_id" IS NULL OR "scores"."opponent_id" <> "scores"."user_id");
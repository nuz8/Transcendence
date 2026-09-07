ALTER TABLE "games" ADD CONSTRAINT "games_name_length" CHECK ("games"."name" = trim("games"."name")
				AND length("games"."name") >= 1
				AND length("games"."name") <= 64);--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_value_non_negative" CHECK ("scores"."value" IS NULL OR "scores"."value" >= 0);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_length" CHECK ("users"."username" = trim("users"."username")
				AND length("users"."username") >= 3
				AND length("users"."username") <= 32);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_format" CHECK ("users"."email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_max_length" CHECK (length("users"."email") <= 254);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_password_hash_bcrypt" CHECK ("users"."password_hash" ~ '^\$2[aby]\$[0-9]{2}\$[A-Za-z0-9./]{53}$');
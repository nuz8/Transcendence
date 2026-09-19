CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"receiver_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_no_self_message" CHECK ("messages"."sender_id" <> "messages"."receiver_id"),
	CONSTRAINT "messages_content_length" CHECK (length("messages"."content") >= 1 AND length("messages"."content") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_sender_receiver_idx" ON "messages" USING btree ("sender_id","receiver_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_receiver_sender_idx" ON "messages" USING btree ("receiver_id","sender_id","created_at");
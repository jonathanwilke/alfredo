CREATE TABLE "credit_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"pack_id" text NOT NULL,
	"credits" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"dodo_session_id" text,
	"payment_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reject_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_checkouts" ADD CONSTRAINT "credit_checkouts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_checkouts_session_idx" ON "credit_checkouts" USING btree ("dodo_session_id");--> statement-breakpoint
CREATE INDEX "credit_checkouts_user_idx" ON "credit_checkouts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_checkouts_payment_idx" ON "credit_checkouts" USING btree ("payment_id");
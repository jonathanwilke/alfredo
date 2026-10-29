CREATE TABLE "credit_balances" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"customer_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"amount" integer NOT NULL,
	"type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"payment_id" text,
	"pack_id" text,
	"product_id" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"estimated_cost_micro_usd" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "welcome_emails" (
	"normalized_email" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "recipe_id" uuid;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "output_tokens" integer;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "estimated_cost_micro_usd" integer;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "is_curated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "source" text DEFAULT 'import' NOT NULL;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_balances_customer_id_idx" ON "credit_balances" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_idempotency_key_idx" ON "credit_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_welcome_user_idx" ON "credit_ledger" USING btree ("user_id") WHERE "credit_ledger"."type" = 'welcome';--> statement-breakpoint
CREATE INDEX "credit_ledger_user_created_idx" ON "credit_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_payment_id_idx" ON "credit_ledger" USING btree ("payment_id");--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipes_curated_idx" ON "recipes" USING btree ("is_curated");
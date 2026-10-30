import type { ExtractedRecipe } from "@repo/ai";
import { relations, sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const importType = pgEnum("import_type", ["import", "translation"]);
export const iconKind = pgEnum("icon_kind", ["ingredient", "recipe"]);
export const iconStatus = pgEnum("icon_status", ["pending", "ready", "failed"]);

export const recipes = pgTable(
	"recipes",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		sourceUrl: text("source_url").notNull(),
		rawData: jsonb("raw_data")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		isCurated: boolean("is_curated").notNull().default(false),
		source: text("source").notNull().default("import"),
		userId: text("user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		sourceRecipeId: uuid("source_recipe_id").references(
			(): AnyPgColumn => recipes.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("recipes_source_url_idx").on(table.sourceUrl),
		index("recipes_curated_idx").on(table.isCurated),
		index("recipes_user_id_idx").on(table.userId),
		uniqueIndex("recipes_user_source_idx")
			.on(table.userId, table.sourceRecipeId)
			.where(sql`${table.sourceRecipeId} is not null`),
	],
);

export const recipeTranslations = pgTable(
	"recipe_translations",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		recipeId: uuid("recipe_id")
			.notNull()
			.references(() => recipes.id, { onDelete: "cascade" }),
		locale: text("locale").notNull(),
		content: jsonb("content").$type<ExtractedRecipe>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("recipe_translations_recipe_locale_idx").on(
			table.recipeId,
			table.locale,
		),
	],
);

export const savedRecipes = pgTable(
	"saved_recipes",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		recipeId: uuid("recipe_id")
			.notNull()
			.references(() => recipes.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("saved_recipes_user_recipe_idx").on(
			table.userId,
			table.recipeId,
		),
	],
);

export const icons = pgTable(
	"icons",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		kind: iconKind("kind").notNull(),
		key: text("key").notNull(),
		recipeId: uuid("recipe_id").references(() => recipes.id, {
			onDelete: "cascade",
		}),
		storageUrl: text("storage_url"),
		prompt: text("prompt").notNull(),
		model: text("model").notNull(),
		status: iconStatus("status").notNull().default("pending"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("icons_kind_key_idx").on(table.kind, table.key),
		index("icons_recipe_id_idx").on(table.recipeId),
	],
);

export const rejectedDomains = pgTable("rejected_domains", {
	domain: text("domain").primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const imports = pgTable(
	"imports",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		type: importType("type").notNull(),
		recipeId: uuid("recipe_id").references(() => recipes.id, {
			onDelete: "set null",
		}),
		model: text("model"),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		estimatedCostMicroUsd: integer("estimated_cost_micro_usd"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("imports_user_created_idx").on(table.userId, table.createdAt),
	],
);

export const recipesRelations = relations(recipes, ({ many }) => ({
	translations: many(recipeTranslations),
	saves: many(savedRecipes),
}));

export const recipeTranslationsRelations = relations(
	recipeTranslations,
	({ one }) => ({
		recipe: one(recipes, {
			fields: [recipeTranslations.recipeId],
			references: [recipes.id],
		}),
	}),
);

export const savedRecipesRelations = relations(savedRecipes, ({ one }) => ({
	user: one(user, {
		fields: [savedRecipes.userId],
		references: [user.id],
	}),
	recipe: one(recipes, {
		fields: [savedRecipes.recipeId],
		references: [recipes.id],
	}),
}));

export const creditLedger = pgTable(
	"credit_ledger",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		amount: integer("amount").notNull(),
		type: text("type").notNull(),
		idempotencyKey: text("idempotency_key").notNull(),
		paymentId: text("payment_id"),
		packId: text("pack_id"),
		productId: text("product_id"),
		model: text("model"),
		inputTokens: integer("input_tokens"),
		outputTokens: integer("output_tokens"),
		estimatedCostMicroUsd: integer("estimated_cost_micro_usd"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("credit_ledger_idempotency_key_idx").on(
			table.idempotencyKey,
		),
		uniqueIndex("credit_ledger_welcome_user_idx")
			.on(table.userId)
			.where(sql`${table.type} = 'welcome'`),
		index("credit_ledger_user_created_idx").on(
			table.userId,
			table.createdAt,
		),
		index("credit_ledger_payment_id_idx").on(table.paymentId),
	],
);

export const creditCheckouts = pgTable(
	"credit_checkouts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		packId: text("pack_id").notNull(),
		credits: integer("credits").notNull(),
		priceCents: integer("price_cents").notNull(),
		currency: text("currency").notNull().default("USD"),
		dodoSessionId: text("dodo_session_id"),
		paymentId: text("payment_id"),
		status: text("status").notNull().default("pending"),
		rejectReason: text("reject_reason"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("credit_checkouts_session_idx").on(table.dodoSessionId),
		index("credit_checkouts_user_idx").on(table.userId),
		index("credit_checkouts_payment_idx").on(table.paymentId),
	],
);

export const creditBalances = pgTable(
	"credit_balances",
	{
		userId: text("user_id")
			.primaryKey()
			.references(() => user.id, { onDelete: "cascade" }),
		balance: integer("balance").notNull().default(0),
		customerId: text("customer_id"),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("credit_balances_customer_id_idx").on(table.customerId)],
);

/** Normalized emails that already received welcome credits. No user FK, so the row stays after account deletion. */
export const welcomeEmails = pgTable("welcome_emails", {
	normalizedEmail: text("normalized_email").primaryKey(),
	userId: text("user_id"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const billingEvents = pgTable("billing_events", {
	id: text("id").primaryKey(),
	type: text("type").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const importsRelations = relations(imports, ({ one }) => ({
	user: one(user, {
		fields: [imports.userId],
		references: [user.id],
	}),
}));

export const creditLedgerRelations = relations(creditLedger, ({ one }) => ({
	user: one(user, {
		fields: [creditLedger.userId],
		references: [user.id],
	}),
}));

export const creditCheckoutsRelations = relations(
	creditCheckouts,
	({ one }) => ({
		user: one(user, {
			fields: [creditCheckouts.userId],
			references: [user.id],
		}),
	}),
);

export const creditBalancesRelations = relations(creditBalances, ({ one }) => ({
	user: one(user, {
		fields: [creditBalances.userId],
		references: [user.id],
	}),
}));

export const iconsRelations = relations(icons, ({ one }) => ({
	recipe: one(recipes, {
		fields: [icons.recipeId],
		references: [recipes.id],
	}),
}));

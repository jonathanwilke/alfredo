import type { ExtractedRecipe } from "@repo/ai";
import { relations } from "drizzle-orm";
import {
	boolean,
	index,
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
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [uniqueIndex("recipes_source_url_idx").on(table.sourceUrl)],
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

export const subscriptions = pgTable(
	"subscriptions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		customerId: text("customer_id").notNull(),
		subscriptionId: text("subscription_id").notNull(),
		productId: text("product_id").notNull(),
		status: text("status").notNull(),
		currentPeriodStart: timestamp("current_period_start", {
			withTimezone: true,
		}),
		currentPeriodEnd: timestamp("current_period_end", {
			withTimezone: true,
		}),
		cancelAtPeriodEnd: boolean("cancel_at_period_end")
			.notNull()
			.default(false),
		lastEventAt: timestamp("last_event_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("subscriptions_subscription_id_idx").on(
			table.subscriptionId,
		),
		index("subscriptions_user_id_idx").on(table.userId),
		index("subscriptions_customer_id_idx").on(table.customerId),
	],
);

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

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
	user: one(user, {
		fields: [subscriptions.userId],
		references: [user.id],
	}),
}));

export const iconsRelations = relations(icons, ({ one }) => ({
	recipe: one(recipes, {
		fields: [icons.recipeId],
		references: [recipes.id],
	}),
}));

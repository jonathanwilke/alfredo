import {
	creditBalances,
	creditLedger,
	db,
	imports,
	user,
	welcomeEmails,
} from "@repo/database";
import { desc, eq, sql } from "drizzle-orm";
import {
	getPaymentsConfig,
	RECIPE_CREDIT_COST,
	WELCOME_CREDITS,
} from "./config";
import {
	applyDebit,
	type CreditStore,
	InsufficientCreditsError,
	type LedgerType,
	presentCreditUsage,
} from "./ledger";
import { applyWelcomeGrant } from "./welcome";

export { InsufficientCreditsError } from "./ledger";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function isUniqueViolation(error: unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}
	if ("code" in error && error.code === "23505") {
		return true;
	}
	if ("cause" in error) {
		return isUniqueViolation(error.cause);
	}
	return false;
}

export function creditStore(tx: Tx): CreditStore {
	return {
		async claimEmail(normalizedEmail, userId) {
			const inserted = await tx
				.insert(welcomeEmails)
				.values({ normalizedEmail, userId })
				.onConflictDoNothing()
				.returning({ email: welcomeEmails.normalizedEmail });
			return inserted.length > 0;
		},
		async lockBalance(userId) {
			await tx
				.insert(creditBalances)
				.values({ userId, balance: 0 })
				.onConflictDoNothing();
			const [row] = await tx
				.select({ balance: creditBalances.balance })
				.from(creditBalances)
				.where(eq(creditBalances.userId, userId))
				.for("update");
			return row?.balance ?? 0;
		},
		async insertEntry(entry) {
			try {
				const inserted = await tx
					.insert(creditLedger)
					.values({
						userId: entry.userId,
						amount: entry.amount,
						type: entry.type,
						idempotencyKey: entry.idempotencyKey,
						paymentId: entry.paymentId ?? null,
						packId: entry.packId ?? null,
						productId: entry.productId ?? null,
						model: entry.model ?? null,
						inputTokens: entry.inputTokens ?? null,
						outputTokens: entry.outputTokens ?? null,
						estimatedCostMicroUsd:
							entry.estimatedCostMicroUsd ?? null,
					})
					.onConflictDoNothing({
						target: creditLedger.idempotencyKey,
					})
					.returning({ id: creditLedger.id });
				return inserted.length > 0;
			} catch (error) {
				if (isUniqueViolation(error)) {
					return false;
				}
				throw error;
			}
		},
		async addBalance(userId, delta) {
			await tx
				.insert(creditBalances)
				.values({ userId, balance: 0 })
				.onConflictDoNothing();
			const [row] = await tx
				.update(creditBalances)
				.set({
					balance: sql`${creditBalances.balance} + ${delta}`,
					updatedAt: new Date(),
				})
				.where(eq(creditBalances.userId, userId))
				.returning({ balance: creditBalances.balance });
			return row?.balance ?? delta;
		},
		async findPurchase(paymentId) {
			const [row] = await tx
				.select({
					userId: creditLedger.userId,
					amount: creditLedger.amount,
				})
				.from(creditLedger)
				.where(eq(creditLedger.idempotencyKey, `purchase:${paymentId}`))
				.limit(1);
			return row ?? null;
		},
	};
}

export async function grantWelcomeCreditsForUser(userId: string) {
	const [row] = await db
		.select({
			id: user.id,
			email: user.email,
			emailVerified: user.emailVerified,
		})
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (!row) {
		return {
			granted: false as const,
			reason: "missing" as const,
			amount: 0,
		};
	}

	return db.transaction((tx) =>
		applyWelcomeGrant(creditStore(tx), {
			userId: row.id,
			email: row.email,
			emailVerified: row.emailVerified,
		}),
	);
}

export async function readBalance(userId: string) {
	const [row] = await db
		.select({ balance: creditBalances.balance })
		.from(creditBalances)
		.where(eq(creditBalances.userId, userId))
		.limit(1);
	return row?.balance ?? 0;
}

export async function getCreditBalance(userId: string) {
	await grantWelcomeCreditsForUser(userId);
	return readBalance(userId);
}

export async function assertCreditsAvailable(
	userId: string,
	cost = RECIPE_CREDIT_COST,
) {
	const balance = await getCreditBalance(userId);
	if (balance < cost) {
		throw new InsufficientCreditsError(balance);
	}
	return balance;
}

export async function debitRecipeCredit(
	tx: Tx,
	input: {
		userId: string;
		recipeId: string;
		locale: string;
		importType: "import" | "translation";
		usage: {
			model: string;
			inputTokens: number;
			outputTokens: number;
			estimatedCostMicroUsd: number;
		};
	},
) {
	const result = await applyDebit(creditStore(tx), {
		userId: input.userId,
		cost: RECIPE_CREDIT_COST,
		idempotencyKey: `import:${input.userId}:${input.recipeId}:${input.locale}`,
		usage: input.usage,
	});

	if (result.debited) {
		await tx.insert(imports).values({
			userId: input.userId,
			type: input.importType,
			recipeId: input.recipeId,
			model: input.usage.model,
			inputTokens: input.usage.inputTokens,
			outputTokens: input.usage.outputTokens,
			estimatedCostMicroUsd: input.usage.estimatedCostMicroUsd,
		});
	}

	return result;
}

export type CreditHistoryEntry = {
	id: string;
	type: LedgerType;
	amount: number;
	createdAt: Date;
	packId: string | null;
};

export async function creditUsageSummary(userId: string) {
	const rows = await db
		.select({
			type: creditLedger.type,
			amount: creditLedger.amount,
		})
		.from(creditLedger)
		.where(eq(creditLedger.userId, userId));

	return presentCreditUsage(
		rows.flatMap((row) => {
			if (!isLedgerType(row.type)) {
				return [];
			}
			return [{ type: row.type, amount: row.amount }];
		}),
	);
}

export async function listCreditHistory(userId: string, limit = 100) {
	const rows = await db
		.select({
			id: creditLedger.id,
			type: creditLedger.type,
			amount: creditLedger.amount,
			createdAt: creditLedger.createdAt,
			packId: creditLedger.packId,
		})
		.from(creditLedger)
		.where(eq(creditLedger.userId, userId))
		.orderBy(desc(creditLedger.createdAt))
		.limit(limit);

	return rows.flatMap((row) => {
		if (!isLedgerType(row.type)) {
			return [];
		}
		return [
			{
				id: row.id,
				type: row.type,
				amount: row.amount,
				createdAt: row.createdAt,
				packId: row.packId,
			} satisfies CreditHistoryEntry,
		];
	});
}

function isLedgerType(value: string): value is LedgerType {
	return (
		value === "welcome" ||
		value === "purchase" ||
		value === "import" ||
		value === "refund" ||
		value === "dispute" ||
		value === "adjustment"
	);
}

export type { LedgerEntry } from "./ledger";

export function billingSnapshot(input: {
	authenticated: boolean;
	balance: number;
}) {
	return {
		authenticated: input.authenticated,
		billingEnabled: getPaymentsConfig().enabled,
		balance: input.authenticated ? input.balance : 0,
		welcomeCredits: WELCOME_CREDITS,
		recipeCreditCost: RECIPE_CREDIT_COST,
	};
}

export const LEDGER_TYPES = [
	"welcome",
	"purchase",
	"import",
	"refund",
	"dispute",
	"adjustment",
] as const;

export type LedgerType = (typeof LEDGER_TYPES)[number];

export type LedgerEntry = {
	userId: string;
	amount: number;
	type: LedgerType;
	idempotencyKey: string;
	paymentId?: string | null;
	packId?: string | null;
	productId?: string | null;
	model?: string | null;
	inputTokens?: number | null;
	outputTokens?: number | null;
	estimatedCostMicroUsd?: number | null;
};

export type CreditStore = {
	claimEmail(normalizedEmail: string, userId: string): Promise<boolean>;
	lockBalance(userId: string): Promise<number>;
	insertEntry(entry: LedgerEntry): Promise<boolean>;
	addBalance(userId: string, delta: number): Promise<number>;
	findPurchase(
		paymentId: string,
	): Promise<{ userId: string; amount: number } | null>;
};

export class InsufficientCreditsError extends Error {
	readonly balance: number;

	constructor(balance: number) {
		super("Insufficient credits");
		this.name = "InsufficientCreditsError";
		this.balance = balance;
	}
}

export async function applyGrant(store: CreditStore, entry: LedgerEntry) {
	const inserted = await store.insertEntry(entry);
	if (!inserted) {
		return "duplicate" as const;
	}
	await store.addBalance(entry.userId, entry.amount);
	return "granted" as const;
}

export async function applyDebit(
	store: CreditStore,
	input: {
		userId: string;
		cost: number;
		idempotencyKey: string;
		usage?: {
			model: string;
			inputTokens: number;
			outputTokens: number;
			estimatedCostMicroUsd: number;
		} | null;
	},
) {
	const balance = await store.lockBalance(input.userId);
	if (balance < input.cost) {
		throw new InsufficientCreditsError(balance);
	}

	const inserted = await store.insertEntry({
		userId: input.userId,
		amount: -input.cost,
		type: "import",
		idempotencyKey: input.idempotencyKey,
		model: input.usage?.model ?? null,
		inputTokens: input.usage?.inputTokens ?? null,
		outputTokens: input.usage?.outputTokens ?? null,
		estimatedCostMicroUsd: input.usage?.estimatedCostMicroUsd ?? null,
	});
	if (!inserted) {
		return { balance, debited: false as const };
	}

	const next = await store.addBalance(input.userId, -input.cost);
	return { balance: next, debited: true as const };
}

export async function applyReversal(
	store: CreditStore,
	input: { paymentId: string; type: "refund" | "dispute" },
) {
	const purchase = await store.findPurchase(input.paymentId);
	if (!purchase || purchase.amount <= 0) {
		return "ignored" as const;
	}

	return applyGrant(store, {
		userId: purchase.userId,
		amount: -purchase.amount,
		type: input.type,
		idempotencyKey: `reversal:${input.paymentId}`,
		paymentId: input.paymentId,
	});
}

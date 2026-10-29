import type { CreditStore, LedgerEntry } from "./ledger";

export function createMemoryStore() {
	const emails = new Map<string, string>();
	const entries = new Map<string, LedgerEntry>();
	const balances = new Map<string, number>();
	const customers = new Map<string, string>();
	let chain: Promise<unknown> = Promise.resolve();

	const store: CreditStore = {
		async claimEmail(normalizedEmail, userId) {
			if (emails.has(normalizedEmail)) {
				return false;
			}
			emails.set(normalizedEmail, userId);
			return true;
		},
		async lockBalance(userId) {
			return balances.get(userId) ?? 0;
		},
		async insertEntry(entry) {
			if (entries.has(entry.idempotencyKey)) {
				return false;
			}
			if (entry.type === "welcome") {
				for (const existing of entries.values()) {
					if (
						existing.type === "welcome" &&
						existing.userId === entry.userId
					) {
						return false;
					}
				}
			}
			entries.set(entry.idempotencyKey, entry);
			return true;
		},
		async addBalance(userId, delta) {
			const next = (balances.get(userId) ?? 0) + delta;
			balances.set(userId, next);
			return next;
		},
		async findPurchase(paymentId) {
			const entry = entries.get(`purchase:${paymentId}`);
			if (!entry) {
				return null;
			}
			return { userId: entry.userId, amount: entry.amount };
		},
	};

	return {
		store,
		emails,
		entries,
		customers,
		balance(userId: string) {
			return balances.get(userId) ?? 0;
		},
		deleteUser(userId: string) {
			balances.delete(userId);
			customers.delete(userId);
			for (const [key, entry] of entries) {
				if (entry.userId === userId) {
					entries.delete(key);
				}
			}
		},
		transaction<T>(fn: () => Promise<T>) {
			const run = chain.then(fn, fn);
			chain = run.then(
				() => undefined,
				() => undefined,
			);
			return run;
		},
	};
}

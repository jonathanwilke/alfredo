import { WELCOME_CREDITS } from "./config";
import { isDisposableEmail, normalizeEmail } from "./email";
import { applyGrant, type CreditStore } from "./ledger";

export type WelcomeResult = {
	granted: boolean;
	reason:
		| "granted"
		| "unverified"
		| "invalid"
		| "disposable"
		| "email-used"
		| "already-granted";
	amount: number;
};

export async function applyWelcomeGrant(
	store: CreditStore,
	input: { userId: string; email: string; emailVerified: boolean },
): Promise<WelcomeResult> {
	if (!input.emailVerified) {
		return { granted: false, reason: "unverified", amount: 0 };
	}

	const email = normalizeEmail(input.email);
	if (!email) {
		return { granted: false, reason: "invalid", amount: 0 };
	}
	if (isDisposableEmail(email)) {
		return { granted: false, reason: "disposable", amount: 0 };
	}

	await store.lockBalance(input.userId);
	const claimed = await store.claimEmail(email, input.userId);
	if (!claimed) {
		return { granted: false, reason: "email-used", amount: 0 };
	}

	const result = await applyGrant(store, {
		userId: input.userId,
		amount: WELCOME_CREDITS,
		type: "welcome",
		idempotencyKey: `welcome:${input.userId}`,
	});
	if (result === "duplicate") {
		return { granted: false, reason: "already-granted", amount: 0 };
	}

	return { granted: true, reason: "granted", amount: WELCOME_CREDITS };
}

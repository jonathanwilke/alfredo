"use server";

import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

export async function inspectConsent(query: string) {
	const { secret } = await auth.$context;
	const valid = await verifyOAuthQueryParams(query, secret);
	if (!valid) {
		return { status: "invalid" as const };
	}
	const session = await auth.api.getSession({
		headers: await headers(),
	});
	if (!session) {
		return { status: "login" as const };
	}
	return {
		status: "ready" as const,
		clientId: new URLSearchParams(query).get("client_id") ?? "",
		email: session.user.email,
	};
}

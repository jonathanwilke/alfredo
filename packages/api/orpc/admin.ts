import { ORPCError } from "@orpc/server";

export function adminEmails() {
	return (process.env.ADMIN_EMAILS ?? "")
		.split(",")
		.map((email) => email.trim().toLowerCase())
		.filter((email) => email.length > 0);
}

export function isAdminEmail(email: string | null | undefined) {
	if (!email) {
		return false;
	}

	return adminEmails().includes(email.trim().toLowerCase());
}

export function requireAdmin(email: string | null | undefined) {
	if (!isAdminEmail(email)) {
		throw new ORPCError("FORBIDDEN");
	}
}

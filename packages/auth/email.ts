import { createHash } from "node:crypto";
import { config } from "@repo/config";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY?.trim();
const resend = apiKey ? new Resend(apiKey) : null;

function sender() {
	const from = process.env.EMAIL_FROM?.trim();
	if (from) {
		return from;
	}
	return `${config.appName} <noreply@ulivo.app>`;
}

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

export async function sendMagicLinkEmail(email: string, url: string) {
	if (!resend) {
		if (process.env.NODE_ENV !== "production") {
			console.info(`[auth] magic link for ${email}: ${url}`);
			return;
		}
		throw new Error("Magic link email delivery is not configured.");
	}

	const app = config.appName;
	const safeUrl = escapeHtml(url);
	const { error } = await resend.emails.send(
		{
			from: sender(),
			to: [email],
			subject: `Anmelden bei ${app}`,
			text: [
				`Hier ist dein Link, um dich bei ${app} anzumelden:`,
				url,
				"Der Link läuft bald ab. Wenn du ihn nicht angefordert hast, kannst du diese E-Mail ignorieren.",
				"",
				`Here is your link to sign in to ${app}:`,
				url,
				"The link expires soon. If you did not request it, you can ignore this email.",
			].join("\n"),
			html: `<p>Hier ist dein Link, um dich bei ${app} anzumelden:</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>Der Link läuft bald ab. Wenn du ihn nicht angefordert hast, kannst du diese E-Mail ignorieren.</p><p>Here is your link to sign in to ${app}:</p><p><a href="${safeUrl}">${safeUrl}</a></p><p>The link expires soon. If you did not request it, you can ignore this email.</p>`,
		},
		{
			idempotencyKey: `magic-link/${createHash("sha256").update(url).digest("hex")}`,
		},
	);

	if (error) {
		throw new Error(error.message);
	}
}

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { config, getBaseUrl } from "@repo/config";
import { account, db, session, user, verification } from "@repo/database";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { sendMagicLinkEmail } from "./email";

function authSecret() {
	const secret = process.env.BETTER_AUTH_SECRET;

	if (secret) {
		return secret;
	}

	if (
		process.env.NEXT_PHASE === "phase-production-build" ||
		process.env.NODE_ENV !== "production"
	) {
		return "local-only-auth-secret-not-for-production-use";
	}

	throw new Error("BETTER_AUTH_SECRET is not set");
}

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const baseURL = process.env.BETTER_AUTH_URL ?? getBaseUrl();

export const auth = betterAuth({
	appName: config.appName,
	baseURL,
	secret: authSecret(),
	trustedOrigins: [baseURL],
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user,
			session,
			account,
			verification,
		},
	}),
	session: {
		expiresIn: config.auth.sessionCookieMaxAge,
		freshAge: 0,
	},
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["google"],
		},
	},
	socialProviders:
		googleClientId && googleClientSecret
			? {
					google: {
						clientId: googleClientId,
						clientSecret: googleClientSecret,
						scope: ["email", "profile"],
					},
				}
			: undefined,
	plugins: [
		magicLink({
			disableSignUp: false,
			sendMagicLink: async ({ email, url }) => {
				await sendMagicLinkEmail(email, url);
			},
		}),
	],
});

export type Session = typeof auth.$Infer.Session;

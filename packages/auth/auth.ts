import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { mcp } from "@better-auth/mcp";
import { config, getBaseUrl, mcpResourceUrl } from "@repo/config";
import {
	account,
	db,
	jwks,
	oauthAccessToken,
	oauthClient,
	oauthClientAssertion,
	oauthClientResource,
	oauthConsent,
	oauthRefreshToken,
	oauthResource,
	session,
	user,
	verification,
} from "@repo/database";
import { grantWelcomeCreditsForUser } from "@repo/payments";
import { betterAuth } from "better-auth";
import { jwt, magicLink } from "better-auth/plugins";
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
	trustedOrigins: [baseURL, "ulivo://", "ulivo://*"],
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user,
			session,
			account,
			verification,
			jwks,
			oauthClient,
			oauthResource,
			oauthClientResource,
			oauthRefreshToken,
			oauthAccessToken,
			oauthConsent,
			oauthClientAssertion,
		},
	}),
	session: {
		expiresIn: config.auth.sessionCookieMaxAge,
		freshAge: 0,
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60,
		},
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
	databaseHooks: {
		session: {
			create: {
				after: async (created) => {
					try {
						await grantWelcomeCreditsForUser(created.userId);
					} catch (error) {
						console.error(
							"[billing] welcome grant failed",
							error instanceof Error
								? error.message
								: "unknown error",
						);
					}
				},
			},
		},
	},
	plugins: [
		jwt(),
		mcp({
			loginPage: "/login",
			consentPage: "/oauth/consent",
			resource: mcpResourceUrl(),
			scopes: ["openid", "profile", "email", "offline_access", "recipes"],
			// Cursor and older Claude clients still register with DCR and use
			// localhost or custom-scheme redirects. CIMD covers current clients.
			allowDynamicClientRegistration: true,
			allowUnauthenticatedClientRegistration: true,
			clientRegistrationDefaultApplicationType: "infer",
		}),
		cimd({
			fetchClientMetadataResource,
			metadataProfile: "mcp-2026-07-28",
		}),
		expo(),
		magicLink({
			disableSignUp: false,
			sendMagicLink: async ({ email, url }) => {
				await sendMagicLinkEmail(email, url);
			},
		}),
	],
});

export type Session = typeof auth.$Infer.Session;

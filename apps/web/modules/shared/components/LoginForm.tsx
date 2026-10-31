"use client";

import { useLocaleRouter } from "@i18n/router";
import { authClient } from "@repo/auth/client";
import { config } from "@repo/config";
import { track } from "@shared/lib/analytics";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useEffect, useId, useState } from "react";

function safeNext(value: string | null) {
	if (
		!value?.startsWith("/") ||
		value.startsWith("//") ||
		value.startsWith("/login")
	) {
		return "/";
	}
	return value;
}

function withLocale(path: string, locale: string) {
	if (locale === config.i18n.defaultLocale) {
		return path;
	}
	return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

function GoogleMark() {
	return (
		<svg aria-hidden viewBox="0 0 18 18" className="size-5">
			<path
				fill="#4285F4"
				d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
			/>
			<path
				fill="#34A853"
				d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z"
			/>
			<path
				fill="#FBBC05"
				d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33z"
			/>
			<path
				fill="#EA4335"
				d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"
			/>
		</svg>
	);
}

export function LoginForm({
	next,
	google,
	googleError,
	oauthFlow = false,
}: {
	next: string | null;
	google: boolean;
	googleError: boolean;
	oauthFlow?: boolean;
}) {
	const t = useTranslations("home");
	const locale = useLocale();
	const router = useLocaleRouter();
	const emailId = useId();
	const messageId = useId();
	const { data: session } = authClient.useSession();
	const destination = safeNext(next);
	const [email, setEmail] = useState("");
	const [pending, setPending] = useState(false);
	const [googlePending, setGooglePending] = useState(false);
	const [notice, setNotice] = useState<string | null>(
		googleError ? t("loginGoogleFailed") : null,
	);
	const [failed, setFailed] = useState(googleError);

	useEffect(() => {
		if (!session) {
			return;
		}
		if (oauthFlow) {
			window.location.assign(`/oauth/consent${window.location.search}`);
			return;
		}
		router.replace(destination);
	}, [session, router, destination, oauthFlow]);

	async function sendLink(event: FormEvent) {
		event.preventDefault();
		const address = email.trim();
		if (!address) {
			return;
		}

		setPending(true);
		setNotice(null);
		setFailed(false);
		const callback = oauthFlow
			? new URL(window.location.href)
			: new URL(withLocale(destination, locale), window.location.origin);
		const { error } = await authClient.signIn.magicLink({
			email: address,
			callbackURL: callback.toString(),
		});
		setPending(false);
		setFailed(Boolean(error));
		if (!error) {
			track("LoginStarted", { method: "email" });
		}
		setNotice(
			error
				? t("loginFailed")
				: process.env.NODE_ENV === "development"
					? t("loginSentDev")
					: t("loginSent"),
		);
	}

	async function continueWithGoogle() {
		setGooglePending(true);
		setNotice(null);
		setFailed(false);
		const callback = oauthFlow
			? new URL(window.location.href)
			: new URL(withLocale(destination, locale), window.location.origin);
		const errorUrl = oauthFlow
			? new URL(window.location.href)
			: new URL(withLocale("/login", locale), window.location.origin);
		if (next) {
			errorUrl.searchParams.set("next", next);
		}
		errorUrl.searchParams.set("error", "google");
		try {
			const { error } = await authClient.signIn.social({
				provider: "google",
				callbackURL: callback.toString(),
				errorCallbackURL: errorUrl.toString(),
			});
			if (error) {
				setGooglePending(false);
				setFailed(true);
				setNotice(t("loginGoogleFailed"));
			} else {
				track("LoginStarted", { method: "google" });
			}
		} catch {
			setGooglePending(false);
			setFailed(true);
			setNotice(t("loginGoogleFailed"));
		}
	}

	return (
		<form
			className="mx-auto flex w-full max-w-md flex-col gap-3"
			onSubmit={(event) => void sendLink(event)}
		>
			{google ? (
				<>
					<Button
						type="button"
						variant="outline"
						loading={googlePending}
						onClick={() => void continueWithGoogle()}
						className="h-12 w-full rounded-full text-lg text-foreground [&>svg]:opacity-100"
					>
						<GoogleMark />
						{t("loginWithGoogle")}
					</Button>
					<p className="text-center text-sm text-muted-foreground">
						{t("loginOr")}
					</p>
				</>
			) : null}
			<label htmlFor={emailId} className="sr-only">
				{t("loginEmail")}
			</label>
			<Input
				id={emailId}
				type="email"
				required
				autoComplete="email"
				value={email}
				placeholder={t("loginEmail")}
				aria-describedby={notice ? messageId : undefined}
				onChange={(event) => setEmail(event.target.value)}
				className="h-12 rounded-full px-5 text-lg"
			/>
			<Button
				type="submit"
				variant="primary"
				loading={pending}
				className="h-12 w-full rounded-full bg-accent px-6 text-lg text-accent-foreground shadow-none hover:bg-accent/90"
			>
				{t("loginSend")}
			</Button>
			{notice ? (
				<p
					id={messageId}
					role={failed ? "alert" : "status"}
					className={
						failed
							? "text-base text-destructive"
							: "text-base text-muted-foreground"
					}
				>
					{notice}
				</p>
			) : null}
		</form>
	);
}

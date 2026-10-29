"use client";

import { useLocaleRouter } from "@i18n/routing";
import { authClient } from "@repo/auth/client";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { useTranslations } from "next-intl";
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

export function LoginForm({ next }: { next: string | null }) {
	const t = useTranslations("home");
	const router = useLocaleRouter();
	const emailId = useId();
	const messageId = useId();
	const { data: session } = authClient.useSession();
	const destination = safeNext(next);
	const [email, setEmail] = useState("");
	const [pending, setPending] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (session) {
			router.replace(destination);
		}
	}, [session, router, destination]);

	async function sendLink(event: FormEvent) {
		event.preventDefault();
		const address = email.trim();
		if (!address) {
			return;
		}

		setPending(true);
		setNotice(null);
		setFailed(false);
		const callback = new URL(destination, window.location.origin);
		const { error } = await authClient.signIn.magicLink({
			email: address,
			callbackURL: callback.toString(),
		});
		setPending(false);
		setFailed(Boolean(error));
		setNotice(
			error
				? t("loginFailed")
				: process.env.NODE_ENV === "development"
					? t("loginSentDev")
					: t("loginSent"),
		);
	}

	return (
		<form
			className="mx-auto flex w-full max-w-md flex-col gap-3"
			onSubmit={(event) => void sendLink(event)}
		>
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

"use client";

import { authClient } from "@repo/auth/client";
import { Button } from "@ui/components/button";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { inspectConsent } from "../lib/oauth-consent";

function clientLabel(clientId: string, fallback: string) {
	if (!clientId) {
		return fallback;
	}
	try {
		return new URL(clientId).hostname;
	} catch {
		return fallback;
	}
}

export function OAuthConsent() {
	const t = useTranslations("consent");
	const [status, setStatus] = useState<"loading" | "invalid" | "ready">(
		"loading",
	);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [pending, setPending] = useState<"allow" | "deny" | null>(null);
	const [failed, setFailed] = useState(false);
	const started = useRef(false);

	useEffect(() => {
		if (started.current) {
			return;
		}
		started.current = true;
		const query = window.location.search.replace(/^\?/, "");
		const unknownClient = t("unknownClient");
		void inspectConsent(query).then((result) => {
			if (result.status === "login") {
				window.location.assign(`/login${window.location.search}`);
				return;
			}
			if (result.status === "invalid") {
				setStatus("invalid");
				return;
			}
			setName(clientLabel(result.clientId, unknownClient));
			setEmail(result.email);
			setStatus("ready");
		});
	}, [t]);

	async function choose(accept: boolean) {
		setPending(accept ? "allow" : "deny");
		setFailed(false);
		const { data, error } = await authClient.oauth2.consent({ accept });
		if (error || !data?.url) {
			setPending(null);
			setFailed(true);
			return;
		}
		window.location.assign(data.url);
	}

	if (status === "loading") {
		return <p className="text-lg text-muted-foreground">{t("loading")}</p>;
	}
	if (status === "invalid") {
		return (
			<p className="text-lg text-muted-foreground" role="alert">
				{t("expired")}
			</p>
		);
	}

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-6">
			<p className="text-center text-lg leading-relaxed text-muted-foreground">
				{t("lead", { name })}
			</p>
			<p className="text-center text-base text-foreground">{email}</p>
			<div className="flex flex-col gap-3">
				<Button
					type="button"
					variant="primary"
					loading={pending === "allow"}
					disabled={pending !== null}
					className="h-12 w-full rounded-full bg-accent px-6 text-lg text-accent-foreground shadow-none hover:bg-accent/90"
					onClick={() => void choose(true)}
				>
					{t("allow")}
				</Button>
				<Button
					type="button"
					variant="outline"
					loading={pending === "deny"}
					disabled={pending !== null}
					className="h-12 w-full rounded-full text-lg text-foreground"
					onClick={() => void choose(false)}
				>
					{t("deny")}
				</Button>
			</div>
			{failed ? (
				<p className="text-base text-destructive" role="alert">
					{t("failed")}
				</p>
			) : null}
		</div>
	);
}

"use client";

import { LocaleLink } from "@i18n/routing";
import { ThemeToggle } from "@shared/components/ThemeToggle";
import { Wordmark } from "@shared/components/Wordmark";
import { api } from "@shared/lib/api";
import { Button } from "@ui/components/button";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { orpcCode } from "../lib/errors";

type BillingStatus = {
	billingEnabled: boolean;
	plan: "free" | "monthly";
	limit: number;
	monthlyLimit: number;
};

export function BillingReturn({
	checkoutStatus,
}: {
	checkoutStatus: string | null;
}) {
	const t = useTranslations("billing");
	const locale = useLocale();
	const [status, setStatus] = useState<BillingStatus | null>(null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const planLocale = locale === "en" ? "en" : "de";

	useEffect(() => {
		let cancelled = false;
		void api.billing
			.status({ locale: planLocale })
			.then((next) => {
				if (!cancelled) {
					setStatus(next);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setStatus(null);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const failed =
		checkoutStatus === "failed" || checkoutStatus === "cancelled";
	const ready = status?.plan === "monthly";
	const succeeded =
		ready || checkoutStatus === "succeeded" || checkoutStatus === "active";

	const title = failed
		? t("returnFailedTitle")
		: succeeded
			? t("returnSuccessTitle")
			: t("returnPendingTitle");
	const body = failed
		? t("returnFailedBody")
		: ready
			? t("returnReadyBody", { limit: status?.monthlyLimit ?? 30 })
			: succeeded
				? t("returnSuccessBody", { limit: status?.monthlyLimit ?? 30 })
				: t("returnPendingBody");

	async function tryAgain() {
		setError(null);
		setPending(true);
		try {
			const { url } = await api.billing.createCheckout({
				locale: planLocale,
			});
			window.location.assign(url);
		} catch (caught) {
			setPending(false);
			setError(
				orpcCode(caught) === "BILLING_DISABLED"
					? t("disabled")
					: t("checkoutError"),
			);
		}
	}

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-8 sm:px-8">
			<header className="flex items-center justify-between gap-4">
				<LocaleLink href="/" className="text-foreground no-underline">
					<Wordmark />
				</LocaleLink>
				<ThemeToggle />
			</header>
			<section className="flex flex-1 flex-col gap-6 py-10 sm:justify-center sm:py-16">
				<h1 className="text-balance text-center text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
					{title}
				</h1>
				<p className="text-center text-lg leading-relaxed text-balance text-muted-foreground">
					{body}
				</p>
				{error ? (
					<p
						role="alert"
						className="max-w-[42ch] text-base text-destructive"
					>
						{error}
					</p>
				) : null}
				<div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
					<Button
						asChild
						variant="primary"
						size="lg"
						className="h-12 rounded-full bg-accent px-6 text-lg text-accent-foreground shadow-none hover:bg-accent/90"
					>
						<LocaleLink href="/">{t("backHome")}</LocaleLink>
					</Button>
					{failed && status?.billingEnabled !== false ? (
						<Button
							type="button"
							variant="ghost"
							size="lg"
							className="h-12 rounded-full px-6 text-lg"
							loading={pending}
							onClick={() => void tryAgain()}
						>
							{t("tryAgain")}
						</Button>
					) : null}
				</div>
			</section>
		</main>
	);
}

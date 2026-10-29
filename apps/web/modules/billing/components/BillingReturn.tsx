"use client";

import { LocaleLink } from "@i18n/routing";
import { SiteFooter } from "@shared/components/SiteFooter";
import { ThemeToggle } from "@shared/components/ThemeToggle";
import { Wordmark } from "@shared/components/Wordmark";
import { api } from "@shared/lib/api";
import { Button } from "@ui/components/button";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useBilling } from "./BillingProvider";

export function BillingReturn({
	checkoutStatus,
}: {
	checkoutStatus: string | null;
}) {
	const t = useTranslations("billing");
	const { openBuy } = useBilling();
	const [balance, setBalance] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;
		let attempts = 0;

		async function load() {
			try {
				const next = await api.billing.balance();
				if (!cancelled) {
					setBalance(next.balance);
				}
			} catch {
				if (!cancelled) {
					setBalance(null);
				}
			}
		}

		void load();
		const timer = window.setInterval(() => {
			attempts += 1;
			if (attempts >= 4) {
				window.clearInterval(timer);
				return;
			}
			void load();
		}, 2000);

		return () => {
			cancelled = true;
			window.clearInterval(timer);
		};
	}, []);

	const failed =
		checkoutStatus === "failed" || checkoutStatus === "cancelled";
	const title = failed
		? t("returnFailedTitle")
		: checkoutStatus === "succeeded" || checkoutStatus === "active"
			? t("returnSuccessTitle")
			: t("returnPendingTitle");
	const body = failed
		? t("returnFailedBody")
		: balance === null
			? t("returnPendingBody")
			: t("returnBalance", { count: balance });

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-8 sm:px-8">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<LocaleLink href="/" className="text-foreground no-underline">
					<Wordmark />
				</LocaleLink>
				<div className="flex flex-wrap items-center justify-end gap-2">
					<ThemeToggle />
				</div>
			</header>
			<section className="flex flex-1 flex-col items-center gap-6 py-10 sm:justify-center sm:py-16">
				<h1 className="max-w-[16ch] text-balance text-center text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
					{title}
				</h1>
				<p className="max-w-[42ch] text-center text-lg leading-relaxed text-balance text-muted-foreground">
					{body}
				</p>
				<div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
					<Button
						asChild
						variant="primary"
						size="lg"
						className="h-12 rounded-full bg-accent px-6 text-lg text-accent-foreground shadow-none hover:bg-accent/90"
					>
						<LocaleLink href="/">{t("backHome")}</LocaleLink>
					</Button>
					{failed ? (
						<Button
							type="button"
							variant="ghost"
							size="lg"
							className="h-12 rounded-full px-6 text-lg"
							onClick={openBuy}
						>
							{t("tryAgain")}
						</Button>
					) : null}
				</div>
			</section>
			<SiteFooter />
		</main>
	);
}

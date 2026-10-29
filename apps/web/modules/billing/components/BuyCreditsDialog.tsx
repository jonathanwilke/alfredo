"use client";

import { LocaleLink } from "@i18n/routing";
import { api } from "@shared/lib/api";
import { Button } from "@ui/components/button";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { orpcCode } from "../lib/errors";
import { formatMoney } from "../lib/format";
import { BillingDialog } from "./BillingDialog";

type Pack = {
	id: "pack_10" | "pack_20" | "pack_50";
	credits: number;
	priceCents: number;
	perRecipeCents: number;
	savingsCents: number;
	currency: "USD";
};

export function BuyCreditsDialog({
	reason,
	onClose,
}: {
	reason: "buy" | "empty" | null;
	onClose: () => void;
}) {
	const t = useTranslations("billing");
	const locale = useLocale();
	const planLocale = locale === "en" ? "en" : "de";
	const [packs, setPacks] = useState<Pack[] | null>(null);
	const [welcomeCredits, setWelcomeCredits] = useState<number | null>(null);
	const [billingEnabled, setBillingEnabled] = useState(true);
	const [loadError, setLoadError] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);
	const [pendingPack, setPendingPack] = useState<Pack["id"] | null>(null);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		if (!reason) {
			return;
		}
		let cancelled = false;
		setLoadError(false);
		setActionError(null);
		void Promise.all([api.billing.packs(), api.billing.balance()])
			.then(([nextPacks, balance]) => {
				if (cancelled) {
					return;
				}
				setPacks(nextPacks);
				setWelcomeCredits(balance.welcomeCredits);
				setBillingEnabled(balance.billingEnabled);
			})
			.catch(() => {
				if (!cancelled) {
					setLoadError(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [reason, attempt]);

	const title = reason === "empty" ? t("emptyTitle") : t("buyTitle");
	const description =
		welcomeCredits == null
			? t("loading")
			: t("buyBody", { count: welcomeCredits });

	async function buy(pack: Pack) {
		setActionError(null);
		setPendingPack(pack.id);
		try {
			const { url } = await api.billing.createCheckout({
				locale: planLocale,
				pack: pack.id,
			});
			window.location.assign(url);
		} catch (error) {
			setPendingPack(null);
			const code = orpcCode(error);
			setActionError(
				code === "BILLING_DISABLED"
					? t("disabled")
					: t("checkoutError"),
			);
		}
	}

	return (
		<BillingDialog
			open={reason !== null}
			title={title}
			description={loadError ? t("loadError") : description}
			onClose={() => {
				setPendingPack(null);
				setActionError(null);
				onClose();
			}}
		>
			<div className="flex flex-col gap-4">
				{loadError ? (
					<Button
						type="button"
						variant="ghost"
						className="h-12 self-start rounded-full px-6 text-lg"
						onClick={() => setAttempt((value) => value + 1)}
					>
						{t("retry")}
					</Button>
				) : null}
				{!loadError && packs ? (
					<ul className="flex flex-col gap-3">
						{packs.map((pack) => {
							const price = formatMoney(
								pack.priceCents,
								pack.currency,
								locale,
							);
							const perRecipe = formatMoney(
								pack.perRecipeCents,
								pack.currency,
								locale,
							);
							const savings =
								pack.savingsCents > 0
									? formatMoney(
											pack.savingsCents,
											pack.currency,
											locale,
										)
									: null;
							return (
								<li key={pack.id}>
									<button
										type="button"
										disabled={
											!billingEnabled ||
											pendingPack !== null
										}
										aria-busy={pendingPack === pack.id}
										onClick={() => void buy(pack)}
										className="flex w-full min-w-0 items-center justify-between gap-4 rounded-3xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
									>
										<span className="min-w-0">
											<span className="block text-lg font-semibold text-foreground">
												{t("packCredits", {
													count: pack.credits,
												})}
											</span>
											<span className="block text-base text-muted-foreground">
												{t("perRecipe", {
													price: perRecipe,
												})}
											</span>
											{savings ? (
												<span className="block text-base text-foreground">
													{t("saveAmount", {
														amount: savings,
													})}
												</span>
											) : null}
										</span>
										<span className="shrink-0 text-lg font-semibold text-foreground tabular-nums">
											{pendingPack === pack.id
												? t("checkoutPending")
												: price}
										</span>
									</button>
								</li>
							);
						})}
					</ul>
				) : null}
				{!billingEnabled && !loadError ? (
					<p className="text-base text-muted-foreground">
						{t("disabled")}
					</p>
				) : null}
				{actionError ? (
					<p role="alert" className="text-base text-destructive">
						{actionError}
					</p>
				) : null}
				<div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
					<LocaleLink
						href="/billing"
						className="text-base text-foreground underline-offset-4 hover:underline"
						onClick={onClose}
					>
						{t("historyLink")}
					</LocaleLink>
					<Button
						type="button"
						variant="ghost"
						size="lg"
						className="h-12 rounded-full px-6 text-lg"
						onClick={onClose}
					>
						{t("close")}
					</Button>
				</div>
			</div>
		</BillingDialog>
	);
}

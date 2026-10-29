"use client";

import { api } from "@shared/lib/api";
import { Button } from "@ui/components/button";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { orpcCode } from "../lib/errors";
import { formatPlanDate, formatPlanPrice } from "../lib/format";
import { BillingDialog } from "./BillingDialog";

type BillingStatus = {
	billingEnabled: boolean;
	authenticated: boolean;
	plan: "free" | "monthly";
	status: string | null;
	cancelAtPeriodEnd: boolean;
	periodEnd: string | null;
	used: number;
	limit: number;
	allowed: boolean;
	hasCustomer: boolean;
	monthlyLimit: number;
	priceCents: number;
	currency: "USD" | "EUR";
};

type DialogMode = "paywall" | "pricing" | null;

const primaryButton =
	"h-12 rounded-full bg-accent px-6 text-lg text-accent-foreground shadow-none hover:bg-accent/90";

export function BillingSection({
	openPaywallToken,
}: {
	openPaywallToken: number;
}) {
	const t = useTranslations("billing");
	const locale = useLocale();
	const [status, setStatus] = useState<BillingStatus | null>(null);
	const [dialog, setDialog] = useState<DialogMode>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [redirecting, setRedirecting] = useState<
		"checkout" | "portal" | null
	>(null);
	const planLocale = locale === "en" ? "en" : "de";

	const load = useCallback(async () => {
		try {
			const next = await api.billing.status({ locale: planLocale });
			setStatus(next);
		} catch {
			setStatus(null);
		}
	}, [planLocale]);

	useEffect(() => {
		if (openPaywallToken === 0) {
			return;
		}
		setDialog("paywall");
		void load();
	}, [openPaywallToken, load]);

	const price = formatPlanPrice(
		status?.priceCents ?? 399,
		status?.currency ?? (locale === "en" ? "USD" : "EUR"),
		locale,
	);
	const periodEnd = formatPlanDate(status?.periodEnd ?? null, locale);
	const paywallTitle =
		status?.plan === "monthly"
			? t("paywallMonthlyTitle")
			: t("paywallFreeTitle");
	const paywallBody =
		status?.plan === "monthly"
			? periodEnd
				? t("paywallMonthlyBody", { date: periodEnd })
				: t("paywallMonthlyBodyNoDate")
			: t("paywallFreeBody", {
					limit: status?.monthlyLimit ?? 30,
					price,
				});
	const dialogTitle =
		dialog === "pricing"
			? t("pricingTitle", { limit: status?.monthlyLimit ?? 30 })
			: paywallTitle;
	const dialogBody =
		status && !status.billingEnabled
			? t("disabled")
			: dialog === "pricing"
				? t("pricingBody", { price })
				: paywallBody;

	async function startCheckout() {
		setActionError(null);
		setRedirecting("checkout");
		try {
			const { url } = await api.billing.createCheckout({
				locale: planLocale,
			});
			window.location.assign(url);
		} catch (error) {
			setRedirecting(null);
			setActionError(
				orpcCode(error) === "BILLING_DISABLED"
					? t("disabled")
					: t("checkoutError"),
			);
		}
	}

	async function openPortal() {
		setActionError(null);
		setRedirecting("portal");
		try {
			const { url } = await api.billing.portal({ locale: planLocale });
			window.location.assign(url);
		} catch (error) {
			setRedirecting(null);
			const code = orpcCode(error);
			setActionError(
				code === "NO_CUSTOMER"
					? t("portalEmpty")
					: code === "BILLING_DISABLED"
						? t("disabled")
						: t("portalError"),
			);
		}
	}

	return (
		<BillingDialog
			open={dialog !== null}
			title={dialogTitle}
			description={dialogBody}
			onClose={() => {
				setDialog(null);
				setActionError(null);
			}}
		>
			<div className="flex flex-col gap-4">
				{actionError ? (
					<p role="alert" className="text-base text-destructive">
						{actionError}
					</p>
				) : null}
				<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
					<Button
						type="button"
						variant="ghost"
						size="lg"
						className="h-12 rounded-full px-6 text-lg"
						onClick={() => setDialog(null)}
					>
						{t("close")}
					</Button>
					{status?.billingEnabled && status.plan !== "monthly" ? (
						<Button
							type="button"
							variant="primary"
							size="lg"
							className={primaryButton}
							loading={redirecting === "checkout"}
							onClick={() => void startCheckout()}
						>
							{t("checkoutPending")}
						</Button>
					) : null}
					{status?.plan === "monthly" && status.hasCustomer ? (
						<Button
							type="button"
							variant="primary"
							size="lg"
							className={primaryButton}
							loading={redirecting === "portal"}
							onClick={() => void openPortal()}
						>
							{t("manage")}
						</Button>
					) : null}
				</div>
			</div>
		</BillingDialog>
	);
}

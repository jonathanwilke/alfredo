"use client";

import { authClient } from "@repo/auth/client";
import { api } from "@shared/lib/api";
import { Button } from "@ui/components/button";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
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
	currency: "USD";
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
	const statusRef = useRef<BillingStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [statusError, setStatusError] = useState(false);
	const [dialog, setDialog] = useState<DialogMode>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [redirecting, setRedirecting] = useState<
		"checkout" | "portal" | null
	>(null);
	const planLocale = locale === "en" ? "en" : "de";
	const { data: session } = authClient.useSession();

	const load = useCallback(async (silent = false) => {
		if (!silent) {
			setLoading(true);
		}
		try {
			const next = await api.billing.status();
			statusRef.current = next;
			setStatus(next);
			setStatusError(false);
		} catch {
			if (!statusRef.current) {
				setStatusError(true);
			}
		} finally {
			if (!silent) {
				setLoading(false);
			}
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	useEffect(() => {
		void load(true);
	}, [load, session?.user.id]);

	useEffect(() => {
		if (openPaywallToken > 0) {
			setDialog("paywall");
		}
	}, [openPaywallToken]);

	const price = formatPlanPrice(
		status?.priceCents ?? 399,
		status?.currency ?? "USD",
		locale,
	);
	const periodEnd = formatPlanDate(status?.periodEnd ?? null, locale);
	const quotaLabel =
		status?.plan === "monthly"
			? t("quotaMonthly", { used: status.used, limit: status.limit })
			: t("quotaFree", {
					used: status?.used ?? 0,
					limit: status?.limit ?? 1,
				});
	const periodLine =
		status?.plan === "monthly" && periodEnd
			? status.cancelAtPeriodEnd
				? t("periodCancels", { date: periodEnd })
				: t("periodRenews", { date: periodEnd })
			: status?.authenticated &&
					status.plan === "free" &&
					status.status &&
					status.status !== "active" &&
					status.status !== "pending"
				? t("inactive")
				: null;
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
		<section
			aria-busy={loading && !status}
			className="mx-auto flex w-full max-w-md flex-col gap-3 text-center"
		>
			{loading && !status ? (
				<p className="text-base text-muted-foreground">
					{t("loading")}
				</p>
			) : null}
			{statusError ? (
				<div className="flex flex-col items-center gap-3">
					<p role="alert" className="text-base text-destructive">
						{t("loadError")}
					</p>
					<Button
						type="button"
						variant="ghost"
						size="lg"
						className="h-12 rounded-full px-6 text-lg"
						onClick={() => void load()}
					>
						{t("retry")}
					</Button>
				</div>
			) : null}
			{status && !status.authenticated ? (
				<p className="text-base leading-relaxed text-muted-foreground">
					{t("freeWithAccount")}
				</p>
			) : null}
			{status?.authenticated ? (
				<>
					<p
						className="text-base tabular-nums text-foreground"
						aria-live="polite"
					>
						{quotaLabel}
					</p>
					{periodLine ? (
						<p className="text-base leading-relaxed text-muted-foreground">
							{periodLine}
						</p>
					) : null}
					{status.hasCustomer ? (
						<p className="text-base leading-relaxed text-muted-foreground">
							{t("manageHint")}
						</p>
					) : null}
					{!status.billingEnabled ? (
						<p className="text-base leading-relaxed text-muted-foreground">
							{t("disabled")}
						</p>
					) : null}
					{actionError && dialog === null ? (
						<p role="alert" className="text-base text-destructive">
							{actionError}
						</p>
					) : null}
					<div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
						{status.billingEnabled && status.plan !== "monthly" ? (
							<Button
								type="button"
								variant="primary"
								size="lg"
								className={primaryButton}
								onClick={() => {
									setActionError(null);
									setDialog(
										status.allowed ? "pricing" : "paywall",
									);
								}}
							>
								{t("upgrade")}
							</Button>
						) : null}
						{status.hasCustomer && status.billingEnabled ? (
							<Button
								type="button"
								variant="ghost"
								size="lg"
								className="h-12 rounded-full px-6 text-lg"
								loading={redirecting === "portal"}
								onClick={() => void openPortal()}
							>
								{t("manage")}
							</Button>
						) : null}
					</div>
				</>
			) : null}
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
		</section>
	);
}

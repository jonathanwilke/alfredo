"use client";

import { useLocaleRouter } from "@i18n/routing";
import { api } from "@shared/lib/api";
import { Button } from "@ui/components/button";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { orpcCode } from "../lib/errors";
import { formatCreditDate } from "../lib/format";
import { useBilling } from "./BillingProvider";
import { CreditUsageBar } from "./CreditUsageBar";

type Entry = {
	id: string;
	type:
		| "welcome"
		| "purchase"
		| "import"
		| "refund"
		| "dispute"
		| "adjustment";
	amount: number;
	createdAt: string;
	packId: string | null;
};

export function CreditHistory() {
	const t = useTranslations("billing");
	const locale = useLocale();
	const router = useLocaleRouter();
	const { openBuy } = useBilling();
	const [entries, setEntries] = useState<Entry[] | null>(null);
	const [usage, setUsage] = useState<{
		total: number;
		used: number;
		remaining: number;
	} | null>(null);
	const [failed, setFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setFailed(false);
		void api.billing
			.history()
			.then((result) => {
				if (!cancelled) {
					setEntries(result.entries);
					setUsage(result.usage);
				}
			})
			.catch((error: unknown) => {
				if (cancelled) {
					return;
				}
				if (orpcCode(error) === "UNAUTHORIZED") {
					router.replace(
						`/login?next=${encodeURIComponent("/billing")}`,
					);
					return;
				}
				setFailed(true);
				setEntries([]);
				setUsage(null);
			});
		return () => {
			cancelled = true;
		};
	}, [router, attempt]);

	return (
		<div className="flex flex-col gap-8">
			<p className="max-w-[48ch] text-lg leading-relaxed text-muted-foreground">
				{t("historyIntro")}
			</p>
			<Button
				type="button"
				variant="primary"
				className="h-12 self-start rounded-full bg-accent px-6 text-lg text-accent-foreground shadow-none hover:bg-accent/90"
				onClick={openBuy}
			>
				{t("buyTitle")}
			</Button>
			{usage && !failed ? (
				<CreditUsageBar
					total={usage.total}
					used={usage.used}
					remaining={usage.remaining}
				/>
			) : null}
			{failed ? (
				<div className="flex flex-col items-start gap-3">
					<p role="alert" className="text-lg text-destructive">
						{t("historyError")}
					</p>
					<Button
						type="button"
						variant="ghost"
						className="h-12 rounded-full px-6 text-lg"
						onClick={() => setAttempt((value) => value + 1)}
					>
						{t("retry")}
					</Button>
				</div>
			) : null}
			{entries && entries.length === 0 && !failed ? (
				<p className="max-w-[42ch] text-lg text-muted-foreground">
					{t("historyEmpty")}
				</p>
			) : null}
			{entries && entries.length > 0 ? (
				<ol className="flex flex-col">
					{entries.map((entry) => {
						const date = formatCreditDate(entry.createdAt, locale);
						return (
							<li
								key={entry.id}
								className="flex min-w-0 flex-col gap-1 border-b border-border py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
							>
								<p className="min-w-0 text-lg text-foreground">
									{historyLabel(entry, t)}
								</p>
								{date ? (
									<time
										dateTime={entry.createdAt}
										className="shrink-0 text-base text-muted-foreground tabular-nums"
									>
										{date}
									</time>
								) : null}
							</li>
						);
					})}
				</ol>
			) : null}
			{entries === null && !failed ? (
				<p className="text-lg text-muted-foreground">{t("loading")}</p>
			) : null}
		</div>
	);
}

function historyLabel(
	entry: Entry,
	t: ReturnType<typeof useTranslations<"billing">>,
) {
	const count = Math.abs(entry.amount);
	switch (entry.type) {
		case "welcome":
			return t("historyWelcome", { count });
		case "purchase":
			return t("historyPurchase", { count });
		case "import":
			return t("historyImport", { count });
		case "refund":
			return t("historyRefund", { count });
		case "dispute":
			return t("historyDispute", { count });
		case "adjustment":
			return entry.amount >= 0
				? t("historyAdjustAdd", { count })
				: t("historyAdjustRemove", { count });
	}
}

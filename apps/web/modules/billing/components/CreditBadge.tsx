"use client";

import { authClient } from "@repo/auth/client";
import { api } from "@shared/lib/api";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useBilling } from "./BillingProvider";

export function CreditBadge() {
	const t = useTranslations("billing");
	const { data: session, isPending } = authClient.useSession();
	const { openBuy } = useBilling();
	const [balance, setBalance] = useState<number | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (!session) {
			setBalance(null);
			return;
		}
		let cancelled = false;
		setFailed(false);
		void api.billing
			.balance()
			.then((result) => {
				if (!cancelled) {
					setBalance(result.balance);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setFailed(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [session]);

	if (!session || isPending) {
		return null;
	}

	const label = failed
		? t("balanceUnavailable")
		: balance === null
			? t("loading")
			: t("balance", { count: balance });

	return (
		<button
			type="button"
			onClick={openBuy}
			aria-haspopup="dialog"
			aria-busy={balance === null && !failed}
			className="inline-flex h-11 max-w-full min-w-0 items-center rounded-full bg-accent px-3 text-base font-semibold text-accent-foreground hover:bg-accent/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-4"
		>
			<span className="truncate">{label}</span>
		</button>
	);
}

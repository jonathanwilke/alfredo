"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

export function CreditUsageBar({
	total,
	used,
	remaining,
}: {
	total: number;
	used: number;
	remaining: number;
}) {
	const t = useTranslations("billing");
	const labelId = useId();
	const usedLabel = t("usageOf", { used, total });
	const remainingLabel = t("usageRemaining", { count: remaining });
	const percent = total === 0 ? 0 : Math.min(100, (used / total) * 100);

	return (
		<div className="flex max-w-xl flex-col gap-3">
			<div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
				<p
					id={labelId}
					className="text-lg text-foreground tabular-nums"
				>
					{usedLabel}
				</p>
				<p className="text-base text-muted-foreground tabular-nums">
					{remainingLabel}
				</p>
			</div>
			<div
				role="progressbar"
				aria-labelledby={labelId}
				aria-valuemin={0}
				aria-valuemax={total}
				aria-valuenow={used}
				aria-valuetext={`${usedLabel}, ${remainingLabel}`}
				className="h-2.5 overflow-hidden rounded-full bg-border"
			>
				<div
					className="h-full rounded-full bg-accent"
					style={{ width: `${percent}%` }}
				/>
			</div>
		</div>
	);
}

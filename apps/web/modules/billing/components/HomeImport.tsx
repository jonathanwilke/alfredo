"use client";

import { useLocaleRouter } from "@i18n/routing";
import { authClient } from "@repo/auth/client";
import { RecipeLinkForm } from "@shared/components/RecipeLinkForm";
import { api } from "@shared/lib/api";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useCallback, useEffect, useState } from "react";
import { BillingSection } from "./BillingSection";

const resumedImports = new Set<string>();

function recipeUrlFromImportParam(value: string | null) {
	if (!value) {
		return null;
	}
	try {
		const parsed = new URL(value);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}
		return parsed.href;
	} catch {
		return null;
	}
}

function ResumePendingImport({
	onQuotaExceeded,
	onFailed,
}: {
	onQuotaExceeded: () => void;
	onFailed: (message: string) => void;
}) {
	const t = useTranslations("home");
	const searchParams = useSearchParams();
	const router = useLocaleRouter();
	const locale = useLocale();
	const { data: session, isPending } = authClient.useSession();
	const importUrl = recipeUrlFromImportParam(searchParams.get("import"));

	useEffect(() => {
		if (!importUrl || isPending) {
			return;
		}
		if (!session) {
			const next = `/?import=${encodeURIComponent(importUrl)}`;
			router.replace(`/login?next=${encodeURIComponent(next)}`);
			return;
		}
		if (resumedImports.has(importUrl)) {
			return;
		}
		resumedImports.add(importUrl);

		void api.recipes
			.import({
				url: importUrl,
				locale: locale === "en" ? "en" : "de",
			})
			.then((result) => {
				router.replace(`/recipes/${result.recipeId}`);
			})
			.catch((error: unknown) => {
				const code =
					typeof error === "object" &&
					error !== null &&
					"code" in error
						? String(error.code)
						: "";
				router.replace("/");
				if (code === "QUOTA_EXCEEDED") {
					onQuotaExceeded();
					return;
				}
				const message = error instanceof Error ? error.message : "";
				onFailed(
					message === "fetch_failed" ||
						message === "not_a_recipe" ||
						message === "extract_failed" ||
						message === "not_configured"
						? t(message)
						: t("extract_failed"),
				);
			});
	}, [
		importUrl,
		isPending,
		session,
		locale,
		router,
		onQuotaExceeded,
		onFailed,
		t,
	]);

	return null;
}

export function HomeImport() {
	const [openPaywallToken, setOpenPaywallToken] = useState(0);
	const [resumeError, setResumeError] = useState<string | null>(null);
	const openPaywall = useCallback(() => {
		setOpenPaywallToken((value) => value + 1);
	}, []);

	return (
		<div className="flex flex-col gap-8">
			<Suspense fallback={null}>
				<ResumePendingImport
					onQuotaExceeded={openPaywall}
					onFailed={setResumeError}
				/>
			</Suspense>
			<RecipeLinkForm
				onQuotaExceeded={openPaywall}
				resumeError={resumeError}
			/>
			<BillingSection openPaywallToken={openPaywallToken} />
		</div>
	);
}

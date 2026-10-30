"use client";

import { useLocaleRouter } from "@i18n/router";
import { authClient } from "@repo/auth/client";
import { RecipeLinkForm } from "@shared/components/RecipeLinkForm";
import { api } from "@shared/lib/api";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import { useBilling } from "./BillingProvider";

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

function errorCode(error: unknown) {
	if (typeof error === "object" && error !== null && "code" in error) {
		return String(error.code);
	}
	return "";
}

function ResumePendingImport({
	onInsufficientCredits,
	onFailed,
}: {
	onInsufficientCredits: () => void;
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
				const code = errorCode(error);
				router.replace("/");
				if (code === "INSUFFICIENT_CREDITS") {
					onInsufficientCredits();
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
		onInsufficientCredits,
		onFailed,
		t,
	]);

	return null;
}

export function HomeImport() {
	const { openEmpty } = useBilling();
	const [resumeError, setResumeError] = useState<string | null>(null);

	return (
		<div className="flex flex-col gap-8">
			<Suspense fallback={null}>
				<ResumePendingImport
					onInsufficientCredits={openEmpty}
					onFailed={setResumeError}
				/>
			</Suspense>
			<RecipeLinkForm
				onInsufficientCredits={openEmpty}
				resumeError={resumeError}
			/>
		</div>
	);
}

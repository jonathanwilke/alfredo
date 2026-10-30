"use client";

import { useLocaleRouter } from "@i18n/router";
import { authClient } from "@repo/auth/client";
import { RecipeLinkForm } from "@shared/components/RecipeLinkForm";
import { track } from "@shared/lib/analytics";
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
	onImportUrl,
	onInsufficientCredits,
	onFailed,
}: {
	onImportUrl: (url: string | null) => void;
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
		onImportUrl(importUrl);
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
				track("RecipeImported", { source: "resume" });
				router.replace(`/recipes/${result.recipeId}`);
			})
			.catch((error: unknown) => {
				const code = errorCode(error);
				onImportUrl(null);
				router.replace("/");
				if (code === "INSUFFICIENT_CREDITS") {
					track("CreditsRequired", { source: "import" });
					onInsufficientCredits();
					return;
				}
				const message = error instanceof Error ? error.message : "";
				const reason =
					message === "fetch_failed" ||
					message === "not_a_recipe" ||
					message === "extract_failed" ||
					message === "not_configured"
						? message
						: "extract_failed";
				track("RecipeImportFailed", { reason });
				onFailed(t(reason));
			});
	}, [
		importUrl,
		isPending,
		session,
		locale,
		router,
		onImportUrl,
		onInsufficientCredits,
		onFailed,
		t,
	]);

	return null;
}

export function HomeImport() {
	const { openEmpty } = useBilling();
	const [resumeUrl, setResumeUrl] = useState<string | null>(null);
	const [resumeError, setResumeError] = useState<string | null>(null);

	return (
		<div className="flex flex-col gap-8">
			<Suspense fallback={null}>
				<ResumePendingImport
					onImportUrl={setResumeUrl}
					onInsufficientCredits={openEmpty}
					onFailed={setResumeError}
				/>
			</Suspense>
			<RecipeLinkForm
				onInsufficientCredits={openEmpty}
				resumeUrl={resumeUrl}
				resumeError={resumeError}
			/>
		</div>
	);
}

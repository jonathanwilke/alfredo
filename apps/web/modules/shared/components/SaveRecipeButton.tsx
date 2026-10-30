"use client";

import {
	Bookmark01Icon,
	BookmarkCheck01Icon,
} from "@hugeicons/core-free-icons";
import { useLocaleRouter } from "@i18n/router";
import { useLocalePathname } from "@i18n/routing";
import { authClient } from "@repo/auth/client";
import { track } from "@shared/lib/analytics";
import { api } from "@shared/lib/api";
import { Button } from "@ui/components/button";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useState } from "react";
import { Icon } from "./Icon";

function isUnauthorized(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "UNAUTHORIZED"
	);
}

function returnPath(pathname: string) {
	const params = new URLSearchParams(window.location.search);
	params.set("save", "1");
	const query = params.toString();
	return query ? `${pathname}?${query}` : pathname;
}

export function SaveRecipeButton({
	recipeId,
	children,
}: {
	recipeId: string;
	children?: ReactNode;
}) {
	const t = useTranslations("recipe");
	const router = useLocaleRouter();
	const pathname = useLocalePathname();
	const { data: session, isPending: sessionPending } =
		authClient.useSession();
	const userId = session?.user.id;
	const [saved, setSaved] = useState(false);
	const [pending, setPending] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		void api.recipes
			.saved({ recipeId })
			.then((status) => {
				if (!cancelled) {
					setSaved(status.saved);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setNotice(t("saveFailed"));
				}
			});

		return () => {
			cancelled = true;
		};
	}, [recipeId, t]);

	useEffect(() => {
		if (sessionPending || !userId) {
			return;
		}
		const current = new URL(window.location.href);
		if (current.searchParams.get("save") !== "1") {
			return;
		}
		current.searchParams.delete("save");
		const next = `${current.pathname}${current.search}${current.hash}`;
		window.history.replaceState(null, "", next);

		let cancelled = false;
		void api.recipes
			.save({ recipeId })
			.then(() => {
				if (!cancelled) {
					setSaved(true);
					track("RecipeSaved");
				}
			})
			.catch(() => {
				if (!cancelled) {
					setNotice(t("saveFailed"));
				}
			});

		return () => {
			cancelled = true;
		};
	}, [recipeId, userId, sessionPending, t]);

	function goToLogin() {
		router.push(`/login?next=${encodeURIComponent(returnPath(pathname))}`);
	}

	async function persist(nextSaved: boolean) {
		if (sessionPending) {
			return;
		}
		if (!session) {
			if (nextSaved) {
				goToLogin();
			}
			return;
		}

		setPending(true);
		setNotice(null);
		try {
			if (nextSaved) {
				await api.recipes.save({ recipeId });
			} else {
				await api.recipes.unsave({ recipeId });
			}
			setSaved(nextSaved);
			track(nextSaved ? "RecipeSaved" : "RecipeUnsaved");
		} catch (error) {
			if (isUnauthorized(error) && nextSaved) {
				goToLogin();
				return;
			}
			setNotice(t("saveFailed"));
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="flex flex-col items-start gap-3">
			<div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
				<Button
					type="button"
					variant="ghost"
					loading={pending}
					onClick={() => void persist(!saved)}
					className="h-12 rounded-full px-6 text-lg [&>svg]:opacity-100"
				>
					{saved ? (
						<Icon icon={BookmarkCheck01Icon} aria-hidden />
					) : (
						<Icon icon={Bookmark01Icon} aria-hidden />
					)}
					{saved ? t("saved") : t("save")}
				</Button>
				{children}
			</div>
			{notice ? (
				<p className="max-w-[42ch] text-base text-muted-foreground">
					{notice}
				</p>
			) : null}
		</div>
	);
}

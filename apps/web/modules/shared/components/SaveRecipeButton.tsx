"use client";

import {
	Bookmark01Icon,
	BookmarkCheck01Icon,
} from "@hugeicons/core-free-icons";
import { authClient } from "@repo/auth/client";
import { track } from "@shared/lib/analytics";
import { api } from "@shared/lib/api";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { useTranslations } from "next-intl";
import {
	type FormEvent,
	type ReactNode,
	useEffect,
	useId,
	useState,
} from "react";
import { Icon } from "./Icon";

function isUnauthorized(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "UNAUTHORIZED"
	);
}

export function SaveRecipeButton({
	recipeId,
	children,
}: {
	recipeId: string;
	children?: ReactNode;
}) {
	const t = useTranslations("recipe");
	const emailId = useId();
	const [saved, setSaved] = useState(false);
	const [pending, setPending] = useState(false);
	const [needsSignIn, setNeedsSignIn] = useState(false);
	const [email, setEmail] = useState("");
	const [notice, setNotice] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			const status = await api.recipes.saved({ recipeId });
			if (cancelled) {
				return;
			}
			setSaved(status.saved);

			const current = new URL(window.location.href);
			if (current.searchParams.get("save") !== "1") {
				return;
			}
			current.searchParams.delete("save");
			const next = `${current.pathname}${current.search}${current.hash}`;
			window.history.replaceState(null, "", next);

			try {
				await api.recipes.save({ recipeId });
				if (!cancelled) {
					setSaved(true);
					setNeedsSignIn(false);
					track("RecipeSaved");
				}
			} catch (error) {
				if (!cancelled) {
					setNeedsSignIn(isUnauthorized(error));
					if (!isUnauthorized(error)) {
						setNotice(t("saveFailed"));
					}
				}
			}
		}

		void load().catch(() => {
			if (!cancelled) {
				setNotice(t("saveFailed"));
			}
		});

		return () => {
			cancelled = true;
		};
	}, [recipeId, t]);

	async function persist(nextSaved: boolean) {
		setPending(true);
		setNotice(null);
		try {
			if (nextSaved) {
				await api.recipes.save({ recipeId });
			} else {
				await api.recipes.unsave({ recipeId });
			}
			setSaved(nextSaved);
			setNeedsSignIn(false);
			track(nextSaved ? "RecipeSaved" : "RecipeUnsaved");
		} catch (error) {
			if (isUnauthorized(error)) {
				setNeedsSignIn(true);
			} else {
				setNotice(t("saveFailed"));
			}
		} finally {
			setPending(false);
		}
	}

	async function sendLink(event: FormEvent) {
		event.preventDefault();
		const address = email.trim();
		if (!address) {
			return;
		}

		setPending(true);
		setNotice(null);
		const callback = new URL(window.location.href);
		callback.searchParams.set("save", "1");
		const { error } = await authClient.signIn.magicLink({
			email: address,
			callbackURL: callback.toString(),
		});
		setPending(false);
		if (!error) {
			track("LoginStarted", { method: "email" });
		}
		setNotice(
			error
				? t("saveFailed")
				: process.env.NODE_ENV === "development"
					? t("saveSentDev")
					: t("saveSent"),
		);
	}

	return (
		<div className="flex flex-col items-start gap-3">
			<div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
				<Button
					type="button"
					variant="ghost"
					loading={pending && !needsSignIn}
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
			{needsSignIn ? (
				<form
					onSubmit={(event) => void sendLink(event)}
					className="flex w-full flex-col gap-3 sm:flex-row"
				>
					<label htmlFor={emailId} className="sr-only">
						{t("saveEmail")}
					</label>
					<Input
						id={emailId}
						type="email"
						required
						autoComplete="email"
						value={email}
						placeholder={t("saveEmail")}
						onChange={(event) => setEmail(event.target.value)}
						className="h-12 rounded-full px-5 text-base"
					/>
					<Button
						type="submit"
						variant="primary"
						loading={pending}
						className="h-12 rounded-full px-6 text-lg"
					>
						{t("saveSend")}
					</Button>
				</form>
			) : null}
			{notice ? (
				<p className="max-w-[42ch] text-base text-muted-foreground">
					{notice}
				</p>
			) : null}
		</div>
	);
}

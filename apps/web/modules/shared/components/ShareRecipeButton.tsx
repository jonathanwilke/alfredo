"use client";

import { api } from "@shared/lib/api";
import { Button } from "@ui/components/button";
import { Share2 } from "lucide-react";
import { useState } from "react";

function absolute(path: string) {
	return new URL(path, window.location.origin).toString();
}

export function ShareRecipeButton({
	recipeId,
	title,
	text,
	locale,
	mode,
	path,
	shared: initiallyShared,
	labels,
}: {
	recipeId: string;
	title: string;
	text: string;
	locale: "de" | "en";
	mode: "public" | "owner";
	path?: string;
	shared: boolean;
	labels: {
		share: string;
		stopSharing: string;
		linkCopied: string;
		shareFailed: string;
	};
}) {
	const [pending, setPending] = useState(false);
	const [shared, setShared] = useState(initiallyShared);
	const [toast, setToast] = useState<string | null>(null);

	function showToast(message: string) {
		setToast(message);
		window.setTimeout(() => {
			setToast((current) => (current === message ? null : current));
		}, 2400);
	}

	async function share() {
		setPending(true);
		try {
			const sharePath =
				mode === "public"
					? (path ??
						(locale === "de"
							? `/recipes/${recipeId}`
							: `/${locale}/recipes/${recipeId}`))
					: (
							await api.recipes.share({
								recipeId,
								locale,
							})
						).path;
			if (!sharePath) {
				throw new Error("share");
			}
			const url = absolute(sharePath);
			setShared(true);
			if (typeof navigator.share === "function") {
				try {
					await navigator.share({ title, text, url });
					return;
				} catch (error) {
					if (
						error instanceof DOMException &&
						error.name === "AbortError"
					) {
						return;
					}
				}
			}
			await navigator.clipboard.writeText(url);
			showToast(labels.linkCopied);
		} catch {
			showToast(labels.shareFailed);
		} finally {
			setPending(false);
		}
	}

	async function stopSharing() {
		setPending(true);
		try {
			await api.recipes.unshare({ recipeId });
			setShared(false);
		} catch {
			showToast(labels.shareFailed);
		} finally {
			setPending(false);
		}
	}

	return (
		<>
			<Button
				type="button"
				variant="ghost"
				loading={pending}
				onClick={() => void share()}
				className="h-12 rounded-full px-6 text-lg [&>svg]:opacity-100"
			>
				<Share2 aria-hidden className="size-5" />
				{labels.share}
			</Button>
			{mode === "owner" && shared ? (
				<Button
					type="button"
					variant="ghost"
					loading={pending}
					onClick={() => void stopSharing()}
					className="h-12 rounded-full px-6 text-lg"
				>
					{labels.stopSharing}
				</Button>
			) : null}
			{toast ? (
				<p
					role="status"
					className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg"
				>
					{toast}
				</p>
			) : null}
		</>
	);
}

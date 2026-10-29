"use client";

import { useLocaleRouter } from "@i18n/routing";
import { api } from "@shared/lib/api";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { LinkIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

function errorCode(error: unknown) {
	if (typeof error === "object" && error !== null && "code" in error) {
		return String(error.code);
	}
	return "";
}

function importFailure(error: unknown) {
	const message = error instanceof Error ? error.message : "";
	if (
		message === "fetch_failed" ||
		message === "not_a_recipe" ||
		message === "extract_failed" ||
		message === "not_configured"
	) {
		return message;
	}
	return "extract_failed" as const;
}

export function RecipeLinkForm({
	onInsufficientCredits,
	resumeError,
}: {
	onInsufficientCredits: () => void;
	resumeError?: string | null;
}) {
	const t = useTranslations("home");
	const locale = useLocale();
	const router = useLocaleRouter();
	const inputId = useId();
	const messageId = useId();
	const [url, setUrl] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [invalid, setInvalid] = useState(false);
	const [pending, setPending] = useState(false);

	return (
		<form
			className="flex flex-col gap-3"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				if (pending) {
					return;
				}
				let parsed: URL;
				try {
					parsed = new URL(url.trim());
				} catch {
					setInvalid(true);
					setMessage(t("invalidUrl"));
					return;
				}

				if (
					parsed.protocol !== "http:" &&
					parsed.protocol !== "https:"
				) {
					setInvalid(true);
					setMessage(t("invalidUrl"));
					return;
				}

				setInvalid(false);
				setMessage(null);
				setPending(true);

				void api.recipes
					.import({
						url: parsed.href,
						locale: locale === "en" ? "en" : "de",
					})
					.then((result) => {
						router.push(`/recipes/${result.recipeId}`);
					})
					.catch((error: unknown) => {
						const code = errorCode(error);
						if (code === "INSUFFICIENT_CREDITS") {
							onInsufficientCredits();
							return;
						}
						if (code === "UNAUTHORIZED") {
							const next = `/?import=${encodeURIComponent(parsed.href)}`;
							router.push(
								`/login?next=${encodeURIComponent(next)}`,
							);
							return;
						}
						setInvalid(true);
						setMessage(t(importFailure(error)));
					})
					.finally(() => {
						setPending(false);
					});
			}}
		>
			<label htmlFor={inputId} className="sr-only">
				{t("placeholder")}
			</label>
			<div className="flex flex-col gap-3 sm:flex-row">
				<div className="relative min-w-0 flex-1">
					<LinkIcon
						aria-hidden
						className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-foreground"
					/>
					<Input
						id={inputId}
						name="url"
						type="url"
						inputMode="url"
						autoComplete="off"
						required
						disabled={pending}
						value={url}
						aria-invalid={invalid}
						aria-describedby={
							message || resumeError ? messageId : undefined
						}
						placeholder={t("placeholder")}
						onChange={(event) => {
							setUrl(event.target.value);
							if (message) {
								setInvalid(false);
								setMessage(null);
							}
						}}
						className="h-12 rounded-full pr-5 pl-12 text-lg placeholder:text-muted-foreground aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive"
					/>
				</div>
				<Button
					type="submit"
					variant="primary"
					size="md"
					loading={pending}
					className="h-12 rounded-full bg-accent px-6 text-lg text-accent-foreground shadow-none hover:bg-accent/90"
				>
					{t("submit")}
				</Button>
			</div>
			{(message ?? resumeError) ? (
				<p
					id={messageId}
					role={invalid || resumeError ? "alert" : "status"}
					className={
						invalid || resumeError
							? "text-base text-destructive"
							: "text-base text-muted-foreground"
					}
				>
					{message ?? resumeError}
				</p>
			) : null}
		</form>
	);
}

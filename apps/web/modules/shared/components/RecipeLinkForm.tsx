"use client";

import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

export function RecipeLinkForm() {
	const t = useTranslations("home");
	const inputId = useId();
	const messageId = useId();
	const [url, setUrl] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [invalid, setInvalid] = useState(false);

	return (
		<form
			className="flex flex-col gap-4"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				const trimmed = url.trim();
				let parsed: URL;
				try {
					parsed = new URL(trimmed);
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
				setMessage(t("notConnected"));
			}}
		>
			<label htmlFor={inputId} className="sr-only">
				{t("placeholder")}
			</label>
			<div className="flex flex-col gap-3 sm:flex-row">
				<div className="relative min-w-0 flex-1">
					<LinkIcon
						aria-hidden
						className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-foreground"
					/>
					<Input
						id={inputId}
						name="url"
						type="url"
						inputMode="url"
						autoComplete="off"
						required
						value={url}
						aria-invalid={invalid}
						aria-describedby={message ? messageId : undefined}
						placeholder={t("placeholder")}
						onChange={(event) => {
							setUrl(event.target.value);
							if (invalid) {
								setInvalid(false);
								setMessage(null);
							}
						}}
						className="h-16 rounded-full pr-5 pl-14 text-lg placeholder:text-muted-foreground"
					/>
				</div>
				<Button
					type="submit"
					variant="primary"
					size="lg"
					className="h-16 shrink-0 rounded-full px-8 text-lg sm:w-auto"
				>
					{t("submit")}
				</Button>
			</div>
			{message ? (
				<p
					id={messageId}
					role={invalid ? "alert" : "status"}
					className={
						invalid
							? "text-base text-pretty break-words text-destructive"
							: "text-base text-pretty break-words text-foreground"
					}
				>
					{message}
				</p>
			) : null}
		</form>
	);
}

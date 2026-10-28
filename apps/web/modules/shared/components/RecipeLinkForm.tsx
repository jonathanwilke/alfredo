"use client";

import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

export function RecipeLinkForm() {
	const t = useTranslations("home");
	const inputId = useId();
	const [url, setUrl] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [invalid, setInvalid] = useState(false);

	return (
		<form
			className="flex flex-col gap-3"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				let parsed: URL;
				try {
					parsed = new URL(url);
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
						className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-foreground"
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
						placeholder={t("placeholder")}
						onChange={(event) => {
							setUrl(event.target.value);
							if (message) {
								setInvalid(false);
								setMessage(null);
							}
						}}
						className="h-10 rounded-full pr-4 pl-10 text-base placeholder:text-muted-foreground aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive"
					/>
				</div>
				<Button
					type="submit"
					variant="primary"
					size="md"
					className="h-10 rounded-full px-4 text-base"
				>
					{t("submit")}
				</Button>
			</div>
			{message ? (
				<p
					role={invalid ? "alert" : "status"}
					className={
						invalid
							? "text-base text-destructive"
							: "text-base text-muted-foreground"
					}
				>
					{message}
				</p>
			) : null}
		</form>
	);
}

"use client";

import { Button } from "@ui/components/button";
import { useTranslations } from "next-intl";
import { useState } from "react";

function configJson(url: string) {
	return JSON.stringify({ mcpServers: { ulivo: { url } } }, null, 2);
}

function Block({
	title,
	body,
	text,
	copyLabel,
	copiedLabel,
}: {
	title: string;
	body: string;
	text: string;
	copyLabel: string;
	copiedLabel: string;
}) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	}

	return (
		<section className="flex flex-col gap-3">
			<h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
			<p className="text-lg leading-relaxed text-muted-foreground">
				{body}
			</p>
			<pre className="overflow-x-auto rounded-3xl border border-border bg-muted p-4 text-sm text-foreground">
				<code>{text}</code>
			</pre>
			<div>
				<Button
					type="button"
					variant="outline"
					className="h-11 rounded-full px-4 text-base text-foreground"
					onClick={() => void copy()}
				>
					{copied ? copiedLabel : copyLabel}
				</Button>
			</div>
		</section>
	);
}

export function ConnectAssistant({ url }: { url: string }) {
	const t = useTranslations("connect");
	const json = configJson(url);
	const command = `claude mcp add --transport http ulivo ${url}`;

	return (
		<div className="flex flex-col gap-10">
			<Block
				title={t("urlLabel")}
				body={t("urlBody")}
				text={url}
				copyLabel={t("copy")}
				copiedLabel={t("copied")}
			/>
			<Block
				title={t("claudeTitle")}
				body={t("claudeBody")}
				text={json}
				copyLabel={t("copy")}
				copiedLabel={t("copied")}
			/>
			<Block
				title={t("claudeCodeTitle")}
				body={t("claudeCodeBody")}
				text={command}
				copyLabel={t("copy")}
				copiedLabel={t("copied")}
			/>
			<Block
				title={t("cursorTitle")}
				body={t("cursorBody")}
				text={json}
				copyLabel={t("copy")}
				copiedLabel={t("copied")}
			/>
			<Block
				title={t("chatgptTitle")}
				body={t("chatgptBody")}
				text={url}
				copyLabel={t("copy")}
				copiedLabel={t("copied")}
			/>
		</div>
	);
}

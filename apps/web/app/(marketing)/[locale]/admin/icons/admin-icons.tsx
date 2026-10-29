"use client";

import { IconTile } from "@shared/components/IconTile";
import { api } from "@shared/lib/api";
import { Button } from "@ui/components/button";
import { Input } from "@ui/components/input";
import { Label } from "@ui/components/label";
import { useEffect, useState } from "react";

interface AdminIcon {
	id: string;
	key: string;
	status: "pending" | "ready" | "failed";
	version: number;
	url: string | null;
	updatedAt: string;
}

function errorCode(error: unknown) {
	if (typeof error === "object" && error !== null && "code" in error) {
		return String(error.code);
	}
	return "";
}

export function AdminIcons() {
	const [query, setQuery] = useState("");
	const [search, setSearch] = useState("");
	const [icons, setIcons] = useState<AdminIcon[] | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const [refresh, setRefresh] = useState(0);

	useEffect(() => {
		const timer = window.setTimeout(() => setSearch(query), 250);
		return () => window.clearTimeout(timer);
	}, [query]);

	useEffect(() => {
		let stopped = false;
		let timer = 0;

		async function load() {
			try {
				const result = await api.admin.icons.list({ search });
				if (stopped) {
					return;
				}
				setIcons(result.icons);
				setMessage(null);
				if (result.icons.some((icon) => icon.status === "pending")) {
					timer = window.setTimeout(() => {
						void load();
					}, 2000);
				}
			} catch (error) {
				if (stopped) {
					return;
				}
				const code = errorCode(error);
				setMessage(
					code === "FORBIDDEN"
						? "You don't have access to icon admin."
						: "Couldn't load icons.",
				);
				setIcons([]);
			}
		}

		void load();

		return () => {
			stopped = true;
			window.clearTimeout(timer);
		};
	}, [search, refresh]);

	async function regenerate(key: string) {
		setBusyKey(key);
		setMessage(null);
		try {
			await api.admin.icons.regenerate({ key });
			setIcons(
				(current) =>
					current?.map((icon) =>
						icon.key === key
							? { ...icon, status: "pending" }
							: icon,
					) ?? current,
			);
			setRefresh((value) => value + 1);
		} catch (error) {
			const code = errorCode(error);
			setMessage(
				code === "FORBIDDEN"
					? "You don't have access to icon admin."
					: "Couldn't regenerate that icon.",
			);
		} finally {
			setBusyKey(null);
		}
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-2">
				<Label htmlFor="icon-search">Search</Label>
				<Input
					id="icon-search"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="black-pepper-ground"
				/>
			</div>
			{message ? (
				<p className="text-base text-destructive" role="alert">
					{message}
				</p>
			) : null}
			{icons && icons.length === 0 && !message ? (
				<p className="text-lg text-muted-foreground">
					No ingredient icons.
				</p>
			) : null}
			<ul className="flex flex-col gap-3">
				{icons?.map((icon) => (
					<li
						key={icon.id}
						className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3"
					>
						<IconTile
							status={icon.status}
							url={icon.url}
							label={icon.key}
						/>
						<div className="min-w-0 flex-1">
							<p className="truncate font-medium">{icon.key}</p>
							<p className="text-sm text-muted-foreground">
								{icon.status} · v{icon.version}
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							loading={busyKey === icon.key}
							onClick={() => {
								void regenerate(icon.key);
							}}
						>
							Regenerate
						</Button>
					</li>
				))}
			</ul>
		</div>
	);
}

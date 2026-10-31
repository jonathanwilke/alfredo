"use client";

import {
	Bookmark01Icon,
	Coins01Icon,
	Logout01Icon,
	SparklesIcon,
	UserIcon,
} from "@hugeicons/core-free-icons";
import { LocaleLink, useLocalePathname } from "@i18n/routing";
import { authClient } from "@repo/auth/client";
import { track } from "@shared/lib/analytics";
import { optimizableImage } from "@shared/lib/optimizable-image";
import { Button } from "@ui/components/button";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "./Icon";

function subscribe() {
	return () => {};
}

export function LoginButton() {
	const t = useTranslations("home");
	const connect = useTranslations("connect");
	const pathname = useLocalePathname();
	const { data: session, isPending } = authClient.useSession();
	const mounted = useSyncExternalStore(
		subscribe,
		() => true,
		() => false,
	);
	const [open, setOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) {
			return;
		}

		function closeOnOutside(event: MouseEvent) {
			if (!menuRef.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		}

		function closeOnEscape(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setOpen(false);
			}
		}

		document.addEventListener("mousedown", closeOnOutside);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("mousedown", closeOnOutside);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [open]);

	if (!mounted || isPending) {
		return <div className="h-11 w-28" />;
	}

	if (session) {
		const image = session.user.image?.trim() || null;
		return (
			<div className="relative" ref={menuRef}>
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="overflow-hidden rounded-full p-0"
					aria-label={t("account")}
					aria-expanded={open}
					aria-haspopup="menu"
					onClick={() => setOpen((current) => !current)}
				>
					{image && optimizableImage(image) ? (
						<Image
							src={image}
							alt=""
							width={44}
							height={44}
							className="size-full object-cover"
						/>
					) : image ? (
						// biome-ignore lint/performance/noImgElement: this host is outside the image optimizer
						<img
							src={image}
							alt=""
							className="size-full object-cover"
						/>
					) : (
						<Icon icon={UserIcon} aria-hidden />
					)}
				</Button>
				{open ? (
					<div
						role="menu"
						className="absolute top-full right-0 z-10 mt-2 flex w-56 flex-col rounded-3xl border border-border bg-popover p-2"
					>
						<LocaleLink
							href="/billing"
							role="menuitem"
							className="flex items-center gap-3 rounded-full px-4 py-2.5 text-base text-foreground no-underline hover:bg-muted"
							onClick={() => setOpen(false)}
						>
							<Icon
								icon={Coins01Icon}
								aria-hidden
								className="shrink-0"
							/>
							{t("recipeCredits")}
						</LocaleLink>
						<LocaleLink
							href="/connect"
							role="menuitem"
							className="flex items-center gap-3 rounded-full px-4 py-2.5 text-base text-foreground no-underline hover:bg-muted"
							onClick={() => setOpen(false)}
						>
							<Icon
								icon={SparklesIcon}
								aria-hidden
								className="shrink-0"
							/>
							{connect("menu")}
						</LocaleLink>
						<LocaleLink
							href="/saved"
							role="menuitem"
							className="flex items-center gap-3 rounded-full px-4 py-2.5 text-base text-foreground no-underline hover:bg-muted"
							onClick={() => setOpen(false)}
						>
							<Icon
								icon={Bookmark01Icon}
								aria-hidden
								className="shrink-0"
							/>
							{t("savedRecipes")}
						</LocaleLink>
						<button
							type="button"
							role="menuitem"
							className="flex items-center gap-3 rounded-full px-4 py-2.5 text-left text-base text-foreground hover:bg-muted"
							onClick={() => {
								track("SignedOut");
								void authClient.signOut();
							}}
						>
							<Icon
								icon={Logout01Icon}
								aria-hidden
								className="shrink-0"
							/>
							{t("logout")}
						</button>
					</div>
				) : null}
			</div>
		);
	}

	const href =
		pathname === "/login"
			? "/login"
			: `/login?next=${encodeURIComponent(pathname)}`;

	return (
		<Button
			asChild
			variant="outline"
			className="h-11 rounded-full px-4 text-base"
		>
			<LocaleLink href={href}>{t("login")}</LocaleLink>
		</Button>
	);
}

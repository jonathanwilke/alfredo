"use client";

import { LocaleLink, useLocalePathname } from "@i18n/routing";
import { authClient } from "@repo/auth/client";
import { Button } from "@ui/components/button";
import { Bookmark, LogOut, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

function subscribe() {
	return () => {};
}

export function LoginButton() {
	const t = useTranslations("home");
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
		return (
			<div className="relative" ref={menuRef}>
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="rounded-full"
					aria-label={t("account")}
					aria-expanded={open}
					aria-haspopup="menu"
					onClick={() => setOpen((current) => !current)}
				>
					<User className="size-5" />
				</Button>
				{open ? (
					<div
						role="menu"
						className="absolute top-full right-0 z-10 mt-2 flex w-56 flex-col rounded-3xl border border-border bg-popover p-2"
					>
						<LocaleLink
							href="/saved"
							role="menuitem"
							className="flex items-center gap-3 rounded-full px-4 py-2.5 text-base text-foreground no-underline hover:bg-muted"
							onClick={() => setOpen(false)}
						>
							<Bookmark aria-hidden className="size-5 shrink-0" />
							{t("savedRecipes")}
						</LocaleLink>
						<button
							type="button"
							role="menuitem"
							className="flex items-center gap-3 rounded-full px-4 py-2.5 text-left text-base text-foreground hover:bg-muted"
							onClick={() => void authClient.signOut()}
						>
							<LogOut aria-hidden className="size-5 shrink-0" />
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

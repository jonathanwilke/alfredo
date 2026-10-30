"use client";

import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Icon } from "./Icon";

function subscribe() {
	return () => {};
}

export function ThemeToggle() {
	const t = useTranslations("home");
	const { resolvedTheme, setTheme } = useTheme();
	const mounted = useSyncExternalStore(
		subscribe,
		() => true,
		() => false,
	);

	if (!mounted) {
		return <span className="inline-block size-3.5" />;
	}

	const isDark = resolvedTheme === "dark";

	return (
		<button
			type="button"
			aria-label={t("theme")}
			onClick={() => setTheme(isDark ? "light" : "dark")}
			className="inline-flex items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
		>
			<Icon
				icon={isDark ? Sun03Icon : Moon02Icon}
				size={14}
				aria-hidden
			/>
		</button>
	);
}

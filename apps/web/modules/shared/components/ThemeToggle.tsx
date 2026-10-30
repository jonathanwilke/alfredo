"use client";

import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@ui/components/button";
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
		return <div className="size-11" />;
	}

	const isDark = resolvedTheme === "dark";

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label={t("theme")}
			onClick={() => setTheme(isDark ? "light" : "dark")}
		>
			{isDark ? (
				<Icon icon={Sun03Icon} aria-hidden />
			) : (
				<Icon icon={Moon02Icon} aria-hidden />
			)}
		</Button>
	);
}

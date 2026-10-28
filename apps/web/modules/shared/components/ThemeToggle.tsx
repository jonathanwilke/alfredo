"use client";

import { Button } from "@ui/components/button";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

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
		return <div className="size-12" aria-hidden />;
	}

	const isDark = resolvedTheme === "dark";

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label={t("theme")}
			aria-pressed={isDark}
			onClick={() => setTheme(isDark ? "light" : "dark")}
		>
			{isDark ? (
				<SunIcon className="size-5" />
			) : (
				<MoonIcon className="size-5" />
			)}
		</Button>
	);
}

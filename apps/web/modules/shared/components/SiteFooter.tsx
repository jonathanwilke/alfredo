"use client";

import { LocaleLink, useLocalePathname } from "@i18n/routing";
import { config } from "@repo/config";
import { cn } from "@ui/lib";
import { useLocale, useTranslations } from "next-intl";

export function SiteFooter() {
	const t = useTranslations("footer");
	const locale = useLocale();
	const pathname = useLocalePathname();
	const locales = Object.entries(config.i18n.locales);

	return (
		<footer className="mt-16 pb-8 text-center">
			<p className="text-sm text-muted-foreground">
				{t("builtBy")}{" "}
				<a
					href="https://x.com/jonathan_wilke"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary transition-colors hover:text-primary/80"
				>
					@jonathan_wilke
				</a>
				{" · "}
				{t("broughtBy")}{" "}
				<a
					href="https://supastarter.dev"
					target="_blank"
					rel="noopener noreferrer"
					className="text-primary transition-colors hover:text-primary/80"
				>
					supastarter.dev
				</a>
			</p>
			<nav
				aria-label={t("language")}
				className="mt-3 text-xs text-muted-foreground"
			>
				{locales.map(([code, { label }], index) => (
					<span key={code}>
						{index > 0 ? " · " : null}
						<LocaleLink
							href={pathname}
							locale={code}
							hrefLang={code}
							aria-current={code === locale ? "page" : undefined}
							className={cn(
								"rounded-sm underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
								code === locale
									? "text-foreground"
									: "text-muted-foreground",
							)}
						>
							{label}
						</LocaleLink>
					</span>
				))}
			</nav>
		</footer>
	);
}

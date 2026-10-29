import { CreditBadge } from "@billing/components/CreditBadge";
import { HomeImport } from "@billing/components/HomeImport";
import { StarterRecipes } from "@billing/components/StarterRecipes";
import { listStarterRecipes } from "@repo/api";
import { config } from "@repo/config";
import { LoginButton } from "@shared/components/LoginButton";
import { SiteFooter } from "@shared/components/SiteFooter";
import { ThemeToggle } from "@shared/components/ThemeToggle";
import { Wordmark } from "@shared/components/Wordmark";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string }>;
}): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "home" });

	return {
		title: `${config.appName} · ${t("title")}`,
		description: t("subtitle"),
	};
}

export default async function HomePage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("home");
	const starters = await listStarterRecipes(locale).catch(() => []);

	return (
		<main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-5 pt-8 [--home-nav:calc(2rem+2.75rem)] sm:px-8">
			<header className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-3">
				<p className="leading-none">
					<Wordmark />
				</p>
				<div className="flex flex-wrap items-center justify-end gap-2">
					<CreditBadge />
					<LoginButton />
					<ThemeToggle />
				</div>
			</header>
			<section className="flex flex-1 flex-col justify-center gap-8 py-8">
				<div className="flex flex-col gap-5">
					<h1 className="text-balance text-center text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
						{t("title")}
					</h1>
					<p className="text-center text-lg leading-relaxed text-balance text-muted-foreground">
						{t("subtitle")}
					</p>
				</div>
				<HomeImport />
				<StarterRecipes recipes={starters} />
			</section>
			<SiteFooter />
		</main>
	);
}

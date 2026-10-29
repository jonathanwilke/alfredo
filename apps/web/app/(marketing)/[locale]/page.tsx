import { HomeImport } from "@billing/components/HomeImport";
import { config } from "@repo/config";
import { LoginButton } from "@shared/components/LoginButton";
import { ThemeToggle } from "@shared/components/ThemeToggle";
import { Wordmark } from "@shared/components/Wordmark";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

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

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col px-5 pt-8 [--home-nav:calc(2rem+2.75rem)] sm:px-8">
			<header className="flex h-11 shrink-0 items-center justify-between gap-4">
				<p className="leading-none">
					<Wordmark />
				</p>
				<div className="flex items-center gap-2">
					<LoginButton />
					<ThemeToggle />
				</div>
			</header>
			<section className="flex min-h-[calc(100svh-var(--home-nav))] flex-col justify-center gap-8 py-8">
				<div className="flex flex-col gap-5">
					<h1 className="text-balance text-center text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
						{t("title")}
					</h1>
					<p className="text-center text-lg leading-relaxed text-balance text-muted-foreground">
						{t("subtitle")}
					</p>
				</div>
				<HomeImport />
			</section>
		</main>
	);
}

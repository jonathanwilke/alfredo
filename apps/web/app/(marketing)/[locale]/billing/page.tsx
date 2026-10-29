import { CreditBadge } from "@billing/components/CreditBadge";
import { CreditHistory } from "@billing/components/CreditHistory";
import { LocaleLink } from "@i18n/routing";
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
	const t = await getTranslations({ locale, namespace: "billing" });

	return {
		title: `${config.appName} · ${t("pageTitle")}`,
	};
}

export default async function BillingPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("billing");

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-8 sm:px-8">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<LocaleLink href="/" className="text-foreground no-underline">
					<Wordmark />
				</LocaleLink>
				<div className="flex flex-wrap items-center justify-end gap-2">
					<CreditBadge />
					<LoginButton />
					<ThemeToggle />
				</div>
			</header>
			<section className="flex flex-col gap-8 py-10">
				<h1 className="text-balance text-5xl leading-[1.05] font-semibold tracking-tight">
					{t("pageTitle")}
				</h1>
				<CreditHistory />
			</section>
		</main>
	);
}

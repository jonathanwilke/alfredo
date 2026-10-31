import { LocaleLink } from "@i18n/routing";
import { config } from "@repo/config";
import { OAuthConsent } from "@shared/components/OAuthConsent";
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
	const t = await getTranslations({ locale, namespace: "consent" });
	return { title: `${config.appName} · ${t("title")}` };
}

export default async function ConsentPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("consent");

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-8 sm:px-8">
			<header>
				<LocaleLink href="/" className="text-foreground no-underline">
					<Wordmark />
				</LocaleLink>
			</header>
			<section className="flex flex-1 flex-col gap-8 py-10 sm:justify-center sm:py-16">
				<h1 className="text-balance text-center text-5xl leading-[1.05] font-semibold tracking-tight">
					{t("title")}
				</h1>
				<OAuthConsent />
			</section>
		</main>
	);
}

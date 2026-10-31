import { LocaleLink } from "@i18n/routing";
import { config, mcpResourceUrl } from "@repo/config";
import { ConnectAssistant } from "@shared/components/ConnectAssistant";
import { LoginButton } from "@shared/components/LoginButton";
import { SiteFooter } from "@shared/components/SiteFooter";
import { Wordmark } from "@shared/components/Wordmark";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ locale: string }>;
}): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "connect" });
	return { title: `${config.appName} · ${t("title")}` };
}

export default async function ConnectPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("connect");

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-8 sm:px-8">
			<header className="flex items-center justify-between gap-4">
				<LocaleLink href="/" className="text-foreground no-underline">
					<Wordmark />
				</LocaleLink>
				<LoginButton />
			</header>
			<section className="flex flex-1 flex-col gap-8 py-10">
				<div className="flex flex-col gap-4">
					<h1 className="text-balance text-5xl leading-[1.05] font-semibold tracking-tight">
						{t("title")}
					</h1>
					<p className="text-lg leading-relaxed text-muted-foreground">
						{t("lead")}
					</p>
				</div>
				<ConnectAssistant url={mcpResourceUrl()} />
			</section>
			<SiteFooter />
		</main>
	);
}

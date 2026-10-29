import { LocaleLink } from "@i18n/routing";
import { config } from "@repo/config";
import { LoginButton } from "@shared/components/LoginButton";
import { LoginForm } from "@shared/components/LoginForm";
import { SiteFooter } from "@shared/components/SiteFooter";
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
		title: `${config.appName} · ${t("login")}`,
	};
}

export default async function LoginPage({
	params,
	searchParams,
}: {
	params: Promise<{ locale: string }>;
	searchParams: Promise<{ next?: string; error?: string }>;
}) {
	const { locale } = await params;
	const { next, error } = await searchParams;
	setRequestLocale(locale);
	const t = await getTranslations("home");
	const google =
		Boolean(process.env.GOOGLE_CLIENT_ID) &&
		Boolean(process.env.GOOGLE_CLIENT_SECRET);

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-8 sm:px-8">
			<header className="flex items-center justify-between gap-4">
				<LocaleLink href="/" className="text-foreground no-underline">
					<Wordmark />
				</LocaleLink>
				<div className="flex items-center gap-2">
					<LoginButton />
					<ThemeToggle />
				</div>
			</header>
			<section className="flex flex-1 flex-col gap-8 py-10 sm:justify-center sm:py-16">
				<div className="flex flex-col gap-5">
					<h1 className="text-balance text-center text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl">
						{t("login")}
					</h1>
					<p className="text-center text-lg leading-relaxed text-muted-foreground">
						{google ? t("loginLeadGoogle") : t("loginLead")}
					</p>
				</div>
				<LoginForm
					next={typeof next === "string" ? next : null}
					google={google}
					googleError={typeof error === "string"}
				/>
			</section>
			<SiteFooter />
		</main>
	);
}

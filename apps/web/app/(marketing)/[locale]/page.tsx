import { IconTile } from "@shared/components/IconTile";
import { LocaleSwitch } from "@shared/components/LocaleSwitch";
import { RecipeLinkForm } from "@shared/components/RecipeLinkForm";
import { ThemeToggle } from "@shared/components/ThemeToggle";
import { Card } from "@ui/components/card";
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
		title: `alfredo · ${t("title")}`,
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
		<main
			className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-8 py-8"
			style={{ paddingInline: "2rem" }}
		>
			<header className="flex flex-wrap items-center justify-between gap-4">
				<p className="font-heading text-3xl leading-none">alfredo</p>
				<div className="flex items-center gap-2">
					<LocaleSwitch />
					<ThemeToggle />
				</div>
			</header>
			<section className="flex flex-1 flex-col justify-center gap-8 py-16">
				<div className="flex max-w-[22ch] flex-col gap-4">
					<h1 className="text-6xl leading-[1.05] font-medium">
						{t("title")}
					</h1>
					<p className="max-w-[42ch] text-lg leading-relaxed text-muted-foreground">
						{t("subtitle")}
					</p>
				</div>
				<Card className="flex flex-col gap-5 p-4 shadow-card sm:p-6">
					<IconTile
						size="hero"
						status="pending"
						label={t("iconEmpty")}
					/>
					<p className="max-w-[48ch] text-base leading-relaxed text-muted-foreground">
						{t("iconsCaption")}
					</p>
					<RecipeLinkForm />
				</Card>
			</section>
		</main>
	);
}

import { IconTile } from "@shared/components/IconTile";
import { RecipeLinkForm } from "@shared/components/RecipeLinkForm";
import { ThemeToggle } from "@shared/components/ThemeToggle";
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
		<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-8 sm:px-8">
			<header className="flex items-center justify-between gap-4">
				<p className="font-heading text-3xl leading-none">alfredo</p>
				<ThemeToggle />
			</header>
			<section className="flex flex-1 flex-col gap-8 py-10 sm:justify-center sm:py-16">
				<div className="flex flex-col gap-5">
					<h1 className="max-w-[22ch] text-balance text-5xl leading-[1.05] font-medium sm:text-6xl">
						{t("title")}
					</h1>
					<p className="max-w-[42ch] text-lg leading-relaxed text-muted-foreground">
						{t("subtitle")}
					</p>
				</div>
				<div className="flex flex-col gap-8">
					<div className="flex flex-col gap-4">
						<IconTile
							size="hero"
							status="pending"
							label={t("iconPending")}
						/>
						<p className="max-w-[48ch] text-base leading-relaxed text-muted-foreground">
							{t("iconsCaption")}
						</p>
					</div>
					<RecipeLinkForm />
				</div>
			</section>
		</main>
	);
}

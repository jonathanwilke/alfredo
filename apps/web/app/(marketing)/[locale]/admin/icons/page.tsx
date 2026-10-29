import { LocaleLink, localeRedirect } from "@i18n/routing";
import { isAdminEmail } from "@repo/api/admin";
import { auth } from "@repo/auth";
import { config } from "@repo/config";
import { LoginButton } from "@shared/components/LoginButton";
import { ThemeToggle } from "@shared/components/ThemeToggle";
import { Wordmark } from "@shared/components/Wordmark";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { AdminIcons } from "./admin-icons";

export const metadata: Metadata = {
	title: `${config.appName} · Icons`,
};

export default async function AdminIconsPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		localeRedirect({ href: "/login?next=/admin/icons", locale });
		return null;
	}

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
			<section className="flex flex-col gap-8 py-10">
				<div className="flex flex-col gap-3">
					<h1 className="text-5xl leading-[1.05] font-semibold tracking-tight">
						Ingredient icons
					</h1>
					<p className="text-lg text-muted-foreground">
						One image per ingredient. Regenerate overwrites that
						object.
					</p>
				</div>
				{isAdminEmail(session.user.email) ? (
					<AdminIcons />
				) : (
					<p className="text-lg text-muted-foreground">
						You don't have access to icon admin.
					</p>
				)}
			</section>
		</main>
	);
}

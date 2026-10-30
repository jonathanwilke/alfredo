import { BillingProvider } from "@billing/components/BillingProvider";
import { routing } from "@i18n/routing";
import { getBaseUrl } from "@repo/config";
import { AnalyticsUser } from "@shared/components/AnalyticsUser";
import { Document } from "@shared/components/Document";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import type { PropsWithChildren } from "react";
import "../../globals.css";

export const metadata: Metadata = {
	metadataBase: new URL(getBaseUrl()),
};

export function generateStaticParams() {
	return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
	children,
	params,
}: PropsWithChildren<{ params: Promise<{ locale: string }> }>) {
	const { locale } = await params;

	if (!hasLocale(routing.locales, locale)) {
		notFound();
	}

	setRequestLocale(locale);
	const messages = await getMessages();

	return (
		<Document locale={locale}>
			<NextIntlClientProvider messages={messages}>
				<AnalyticsUser />
				<BillingProvider>{children}</BillingProvider>
			</NextIntlClientProvider>
		</Document>
	);
}

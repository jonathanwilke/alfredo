import { BillingReturn } from "@billing/components/BillingReturn";
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
		title: `alfredo · ${t("pageTitle")}`,
	};
}

export default async function BillingReturnPage({
	params,
	searchParams,
}: {
	params: Promise<{ locale: string }>;
	searchParams: Promise<{ status?: string | string[] }>;
}) {
	const { locale } = await params;
	const query = await searchParams;
	setRequestLocale(locale);
	const checkoutStatus = Array.isArray(query.status)
		? (query.status[0] ?? null)
		: (query.status ?? null);

	return <BillingReturn checkoutStatus={checkoutStatus} />;
}

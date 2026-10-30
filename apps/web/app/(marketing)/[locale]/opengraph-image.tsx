import { defaultOgResponse, ogSize } from "@shared/og";
import { getTranslations } from "next-intl/server";

export const alt = "ulivo";
export const size = ogSize;
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "home" });
	return defaultOgResponse({
		title: t("title"),
		tagline: t("subtitle"),
	});
}

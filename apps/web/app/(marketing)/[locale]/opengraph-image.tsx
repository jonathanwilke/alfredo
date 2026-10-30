import { defaultOgResponse, ogSize } from "@shared/og";
import { getTranslations } from "next-intl/server";

export const alt = "ulivo";
export const size = ogSize;
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image() {
	const t = await getTranslations({ locale: "en", namespace: "home" });
	return defaultOgResponse({
		title: t("title"),
		tagline: t("subtitle"),
	});
}

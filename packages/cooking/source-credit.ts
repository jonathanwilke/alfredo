const SOCIAL_HOSTS = {
	youtube: ["youtube.com", "m.youtube.com", "music.youtube.com"],
	tiktok: ["tiktok.com", "m.tiktok.com"],
	instagram: ["instagram.com", "m.instagram.com"],
};

const INSTAGRAM_RESERVED = new Set([
	"p",
	"reel",
	"reels",
	"stories",
	"explore",
	"accounts",
	"direct",
	"tv",
	"about",
]);

function hostname(url: URL) {
	return url.hostname
		.toLowerCase()
		.replace(/\.$/, "")
		.replace(/^www\./, "");
}

function handle(value: string | undefined) {
	const name = value?.replace(/^@/, "").trim();
	if (!name || !/^[\w.-]+$/.test(name)) {
		return null;
	}
	return `@${name}`;
}

/** Domain, or a social handle when the URL contains one. */
export function sourceCredit(raw: string | null | undefined): {
	href: string;
	label: string;
} | null {
	if (!raw?.trim()) {
		return null;
	}
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		return null;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return null;
	}

	const host = hostname(url);
	const parts = url.pathname.split("/").filter(Boolean);
	let label: string | null = null;

	if (SOCIAL_HOSTS.youtube.includes(host)) {
		const at = parts.find((part) => part.startsWith("@"));
		label = handle(at);
		if (!label && (parts[0] === "c" || parts[0] === "user") && parts[1]) {
			label = handle(parts[1]);
		}
	} else if (SOCIAL_HOSTS.tiktok.includes(host)) {
		label = handle(parts.find((part) => part.startsWith("@")));
	} else if (SOCIAL_HOSTS.instagram.includes(host)) {
		const first = parts[0];
		if (first && !INSTAGRAM_RESERVED.has(first.toLowerCase())) {
			label = handle(first);
		}
	}

	return { href: url.toString(), label: label ?? host };
}

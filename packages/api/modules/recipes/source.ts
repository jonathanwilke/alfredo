import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const blockList = new BlockList();
blockList.addSubnet("0.0.0.0", 8, "ipv4");
blockList.addSubnet("10.0.0.0", 8, "ipv4");
blockList.addSubnet("100.64.0.0", 10, "ipv4");
blockList.addSubnet("127.0.0.0", 8, "ipv4");
blockList.addSubnet("169.254.0.0", 16, "ipv4");
blockList.addSubnet("172.16.0.0", 12, "ipv4");
blockList.addSubnet("192.168.0.0", 16, "ipv4");
blockList.addAddress("255.255.255.255", "ipv4");
blockList.addAddress("::1", "ipv6");
blockList.addSubnet("fc00::", 7, "ipv6");
blockList.addSubnet("fe80::", 10, "ipv6");

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 4;

export class ImportError extends Error {
	constructor(
		readonly reason:
			| "fetch_failed"
			| "not_a_recipe"
			| "extract_failed"
			| "not_configured"
			| "account_required",
	) {
		super(reason);
	}
}

export function normalizeRecipeUrl(raw: string) {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		throw new ImportError("fetch_failed");
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new ImportError("fetch_failed");
	}

	if (url.username || url.password) {
		throw new ImportError("fetch_failed");
	}

	if (url.port && url.port !== "80" && url.port !== "443") {
		throw new ImportError("fetch_failed");
	}

	url.hash = "";
	if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
		url.pathname = url.pathname.slice(0, -1);
	}

	return url;
}

/** Hostname used for the reject list. `www` is folded into the parent domain. */
export function recipeDomain(url: URL) {
	const hostname = url.hostname
		.replace(/^\[|\]$/g, "")
		.toLowerCase()
		.replace(/\.$/, "");

	return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

function blockedAddress(address: string) {
	const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
	if (mapped?.[1]) {
		return blockList.check(mapped[1], "ipv4");
	}

	const family = isIP(address);
	if (family === 4) {
		return blockList.check(address, "ipv4");
	}
	if (family === 6) {
		return blockList.check(address, "ipv6");
	}

	return true;
}

async function assertPublicUrl(url: URL) {
	const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
	if (
		hostname === "localhost" ||
		hostname.endsWith(".localhost") ||
		hostname.endsWith(".local") ||
		hostname === "metadata.google.internal"
	) {
		throw new ImportError("fetch_failed");
	}

	if (isIP(hostname)) {
		if (blockedAddress(hostname)) {
			throw new ImportError("fetch_failed");
		}
		return;
	}

	let records: { address: string }[];
	try {
		records = await lookup(hostname, { all: true, verbatim: true });
	} catch {
		throw new ImportError("fetch_failed");
	}

	if (
		records.length === 0 ||
		records.some((record) => blockedAddress(record.address))
	) {
		throw new ImportError("fetch_failed");
	}
}

async function readLimitedText(response: Response) {
	const reader = response.body?.getReader();
	if (!reader) {
		throw new ImportError("fetch_failed");
	}

	const chunks: Uint8Array[] = [];
	let total = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		if (!value) {
			continue;
		}
		total += value.byteLength;
		if (total > MAX_BYTES) {
			await reader.cancel();
			throw new ImportError("fetch_failed");
		}
		chunks.push(value);
	}

	const body = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return new TextDecoder("utf-8", { fatal: false }).decode(body);
}

function htmlToSource(html: string) {
	const structured: string[] = [];
	for (const match of html.matchAll(
		/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
	)) {
		const json = match[1]?.trim();
		if (json && /Recipe/.test(json)) {
			structured.push(json.slice(0, 20_000));
		}
	}

	const text = html
		.replace(/<script[\s\S]*?<\/script>/gi, " ")
		.replace(/<style[\s\S]*?<\/style>/gi, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 24_000);

	const source = [...structured, text].filter(Boolean).join("\n\n").trim();
	if (!source) {
		throw new ImportError("fetch_failed");
	}

	return source.slice(0, 28_000);
}

export async function fetchRecipeSource(url: URL) {
	let current = url;

	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		await assertPublicUrl(current);
		let response: Response;
		try {
			response = await fetch(current, {
				redirect: "manual",
				signal: AbortSignal.timeout(12_000),
				headers: {
					accept: "text/html,application/xhtml+xml;q=0.9",
					"user-agent": "alfredo-recipe-import",
				},
			});
		} catch {
			throw new ImportError("fetch_failed");
		}

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("location");
			if (!location) {
				throw new ImportError("fetch_failed");
			}
			current = new URL(location, current);
			continue;
		}

		if (!response.ok) {
			throw new ImportError("fetch_failed");
		}

		const type = response.headers.get("content-type") ?? "";
		if (
			type &&
			!type.includes("text/html") &&
			!type.includes("application/xhtml")
		) {
			throw new ImportError("fetch_failed");
		}

		return htmlToSource(await readLimitedText(response));
	}

	throw new ImportError("fetch_failed");
}

export function optimizableImage(src: string) {
	if (src.startsWith("/icons/")) {
		return true;
	}
	try {
		const url = new URL(src);
		const iconPath = url.pathname.startsWith("/icons/");
		if (
			iconPath &&
			(url.hostname === "localhost" || url.hostname === "127.0.0.1")
		) {
			return true;
		}
		if (url.protocol !== "https:") {
			return false;
		}
		if (url.hostname === "lh3.googleusercontent.com") {
			return true;
		}
		return url.hostname.endsWith(".aws.neon.tech") && iconPath;
	} catch {
		return false;
	}
}

import { readFile } from "node:fs/promises";
import path from "node:path";
import { localIconDir } from "@repo/storage";

const FILE_NAME = /^[a-z0-9][a-z0-9-]{0,120}\.webp$/;

export async function GET(
	_request: Request,
	context: { params: Promise<{ kind: string; file: string }> },
) {
	const { kind, file } = await context.params;

	if ((kind !== "ingredient" && kind !== "recipe") || !FILE_NAME.test(file)) {
		return new Response("Not found", { status: 404 });
	}

	try {
		const bytes = await readFile(path.join(localIconDir(), kind, file));
		return new Response(new Uint8Array(bytes), {
			headers: {
				"Content-Type": "image/webp",
				"Cache-Control": "public, max-age=31536000, immutable",
			},
		});
	} catch {
		return new Response("Not found", { status: 404 });
	}
}

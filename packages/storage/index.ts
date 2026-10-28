import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getBaseUrl } from "@repo/config";

export function isRemoteStorageConfigured() {
	return Boolean(
		process.env.S3_ENDPOINT &&
			process.env.S3_ACCESS_KEY_ID &&
			process.env.S3_SECRET_ACCESS_KEY &&
			process.env.S3_BUCKET,
	);
}

export function localIconDir() {
	if (process.env.ICON_LOCAL_DIR) {
		return process.env.ICON_LOCAL_DIR;
	}

	const here = path.dirname(fileURLToPath(import.meta.url));
	return path.resolve(here, "../../.data/icons");
}

let client: S3Client | null = null;

function s3() {
	if (client) {
		return client;
	}

	client = new S3Client({
		region: process.env.S3_REGION || "auto",
		endpoint: process.env.S3_ENDPOINT,
		forcePathStyle: true,
		credentials: {
			accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
			secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
		},
	});

	return client;
}

export async function putPublicObject(input: {
	key: string;
	body: Uint8Array;
	contentType: string;
}) {
	if (!isRemoteStorageConfigured()) {
		const file = path.join(localIconDir(), input.key);
		await mkdir(path.dirname(file), { recursive: true });
		await writeFile(file, input.body);
		return { url: `${getBaseUrl()}/icons/${input.key}` };
	}

	const bucket = process.env.S3_BUCKET as string;
	await s3().send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: input.key,
			Body: input.body,
			ContentType: input.contentType,
			CacheControl: "public, max-age=31536000, immutable",
		}),
	);

	const publicBase = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
	if (publicBase) {
		return { url: `${publicBase}/${input.key}` };
	}

	const endpoint = (process.env.S3_ENDPOINT ?? "").replace(/\/$/, "");
	return { url: `${endpoint}/${bucket}/${input.key}` };
}

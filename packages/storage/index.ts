import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getBaseUrl } from "@repo/config";

/**
 * Neon Object Storage speaks the S3 API and injects AWS-standard env vars.
 * Path-style addressing is required. The client is created on first upload,
 * so a build without credentials never opens a connection.
 */
function storageEnv() {
	return {
		endpoint: process.env.AWS_ENDPOINT_URL_S3,
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		region: process.env.AWS_REGION,
		bucket: process.env.S3_BUCKET,
		publicBaseUrl: process.env.S3_PUBLIC_URL,
	};
}

export function isRemoteStorageConfigured() {
	const env = storageEnv();
	return Boolean(
		env.endpoint &&
			env.accessKeyId &&
			env.secretAccessKey &&
			env.region &&
			env.bucket,
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

	const env = storageEnv();
	client = new S3Client({
		region: env.region,
		endpoint: env.endpoint,
		forcePathStyle: true,
		credentials: {
			accessKeyId: env.accessKeyId ?? "",
			secretAccessKey: env.secretAccessKey ?? "",
		},
	});

	return client;
}

function publicUrl(bucket: string, key: string) {
	const env = storageEnv();
	const publicBase = env.publicBaseUrl?.replace(/\/$/, "");
	if (publicBase) {
		return `${publicBase}/${key}`;
	}

	const endpoint = (env.endpoint ?? "").replace(/\/$/, "");
	return `${endpoint}/${bucket}/${key}`;
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

	const bucket = storageEnv().bucket as string;
	await s3().send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: input.key,
			Body: input.body,
			ContentType: input.contentType,
			CacheControl: "public, max-age=31536000, immutable",
		}),
	);

	return { url: publicUrl(bucket, input.key) };
}

import { copyFile, mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	CopyObjectCommand,
	DeleteObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
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

const INGREDIENT_OBJECT_KEY = /^ingredient\/[a-z0-9][a-z0-9._-]*\.webp$/;

/** Cleanup and overwrite may only touch ingredient objects, never recipe/. */
export function assertIngredientObjectKey(key: string) {
	if (key.includes("..") || !INGREDIENT_OBJECT_KEY.test(key)) {
		throw new Error(`Refusing to touch non-ingredient object "${key}".`);
	}
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

export function publicObjectUrl(key: string) {
	if (!isRemoteStorageConfigured()) {
		return `${getBaseUrl()}/icons/${key}`;
	}

	const bucket = storageEnv().bucket as string;
	return publicUrl(bucket, key);
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
		return { url: publicObjectUrl(input.key) };
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

	return { url: publicObjectUrl(input.key) };
}

export async function listIngredientObjects() {
	if (!isRemoteStorageConfigured()) {
		const dir = path.join(localIconDir(), "ingredient");
		try {
			const files = await readdir(dir);
			return files
				.filter((file) => file.endsWith(".webp"))
				.map((file) => `ingredient/${file}`);
		} catch (error) {
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === "ENOENT"
			) {
				return [];
			}
			throw error;
		}
	}

	const bucket = storageEnv().bucket as string;
	const keys: string[] = [];
	let token: string | undefined;

	do {
		const page = await s3().send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: "ingredient/",
				ContinuationToken: token,
			}),
		);
		for (const item of page.Contents ?? []) {
			if (item.Key?.startsWith("ingredient/")) {
				keys.push(item.Key);
			}
		}
		token = page.IsTruncated ? page.NextContinuationToken : undefined;
	} while (token);

	return keys;
}

export async function copyIngredientObject(from: string, to: string) {
	assertIngredientObjectKey(from);
	assertIngredientObjectKey(to);
	if (from === to) {
		return;
	}

	if (!isRemoteStorageConfigured()) {
		const source = path.join(localIconDir(), from);
		const dest = path.join(localIconDir(), to);
		await mkdir(path.dirname(dest), { recursive: true });
		await copyFile(source, dest);
		return;
	}

	const bucket = storageEnv().bucket as string;
	await s3().send(
		new CopyObjectCommand({
			Bucket: bucket,
			Key: to,
			CopySource: [bucket, ...from.split("/")]
				.map((part) => encodeURIComponent(part))
				.join("/"),
		}),
	);
}

export async function deleteIngredientObject(key: string) {
	assertIngredientObjectKey(key);

	if (!isRemoteStorageConfigured()) {
		await unlink(path.join(localIconDir(), key));
		return;
	}

	const bucket = storageEnv().bucket as string;
	await s3().send(
		new DeleteObjectCommand({
			Bucket: bucket,
			Key: key,
		}),
	);
}

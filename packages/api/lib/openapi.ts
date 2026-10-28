import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { config, getBaseUrl } from "@repo/config";
import { router } from "../orpc/router";

export async function generateOpenApiSpec() {
	return new OpenAPIGenerator({
		schemaConverters: [new ZodToJsonSchemaConverter()],
	}).generate(router, {
		info: {
			title: `${config.appName} API`,
			version: "1.0.0",
		},
		servers: [
			{
				url: `${getBaseUrl()}/api`,
				description: "API server",
			},
		],
	});
}

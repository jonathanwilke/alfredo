import {
	createMcpHandler,
	McpServer,
	ResourceTemplate,
} from "@modelcontextprotocol/server";
import {
	createRecipeFromLink,
	createRecipeFromText,
	getRecipe,
	listRecipes,
	type ToolResult,
	toolDescriptions,
} from "@repo/api";
import { z } from "zod";

type Locale = "de" | "en";

function toolResponse(result: ToolResult) {
	if (!result.ok) {
		return {
			isError: true as const,
			content: [{ type: "text" as const, text: result.message }],
		};
	}
	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(result.data, null, 2),
			},
		],
	};
}

function variable(value: string | string[] | undefined) {
	return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function ulivoMcpHandler(input: { userId: string; locale: Locale }) {
	const context = { userId: input.userId, locale: input.locale };
	return createMcpHandler(
		() => {
			const server = new McpServer({
				name: "ulivo",
				version: "1.0.0",
			});

			server.registerTool(
				"create_recipe_from_link",
				{
					description: toolDescriptions.create_recipe_from_link,
					inputSchema: z.object({
						url: z
							.string()
							.describe(
								"Full http(s) URL of a recipe page or a YouTube, TikTok, or Instagram video.",
							),
						locale: z
							.enum(["de", "en"])
							.optional()
							.describe(
								"Language of the saved recipe. de or en.",
							),
					}),
				},
				async ({ url, locale }) =>
					toolResponse(
						await createRecipeFromLink({ url, locale }, context),
					),
			);

			server.registerTool(
				"create_recipe_from_text",
				{
					description: toolDescriptions.create_recipe_from_text,
					inputSchema: z.object({
						text: z
							.string()
							.describe(
								"The full recipe in markdown or plain text: title, every ingredient with amounts, and every step. Do not shorten it.",
							),
						locale: z
							.enum(["de", "en"])
							.optional()
							.describe(
								"Language to store the recipe in. de or en.",
							),
					}),
				},
				async ({ text, locale }) =>
					toolResponse(
						await createRecipeFromText({ text, locale }, context),
					),
			);

			server.registerTool(
				"list_recipes",
				{
					description: toolDescriptions.list_recipes,
					inputSchema: z.object({
						query: z
							.string()
							.optional()
							.describe("Optional title search."),
						limit: z
							.number()
							.int()
							.min(1)
							.max(50)
							.optional()
							.describe("Page size. Defaults to 20."),
						cursor: z
							.string()
							.optional()
							.describe("nextCursor from the previous page."),
						locale: z.enum(["de", "en"]).optional(),
					}),
				},
				async (args) => toolResponse(await listRecipes(args, context)),
			);

			server.registerTool(
				"get_recipe",
				{
					description: toolDescriptions.get_recipe,
					inputSchema: z.object({
						recipe: z
							.string()
							.describe(
								"ulivo recipe id or ulivo.app recipe URL.",
							),
						locale: z.enum(["de", "en"]).optional(),
					}),
				},
				async ({ recipe, locale }) =>
					toolResponse(await getRecipe({ recipe, locale }, context)),
			);

			server.registerResource(
				"recipe",
				new ResourceTemplate("ulivo://recipes/{id}", {
					list: undefined,
				}),
				{
					title: "Recipe",
					description:
						"One recipe the signed-in user can open, or a public starter. The id is a ulivo recipe id.",
					mimeType: "application/json",
				},
				async (uri, variables) => {
					const result = await getRecipe(
						{ recipe: variable(variables.id) },
						context,
					);
					if (!result.ok) {
						throw new Error(result.message);
					}
					return {
						contents: [
							{
								uri: uri.href,
								mimeType: "application/json",
								text: JSON.stringify(result.data),
							},
						],
					};
				},
			);

			return server;
		},
		{ legacy: "stateless" },
	);
}

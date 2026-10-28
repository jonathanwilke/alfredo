import { createApiClient } from "@repo/api/client";
import { getBaseUrl } from "@repo/config";

export const api = createApiClient(`${getBaseUrl()}/api/rpc`);

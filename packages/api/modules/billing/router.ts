import { createCheckout } from "./procedures/create-checkout";
import { portal } from "./procedures/portal";
import { status } from "./procedures/status";

export const billingRouter = {
	createCheckout,
	portal,
	status,
};

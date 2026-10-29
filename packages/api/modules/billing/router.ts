import { balance } from "./procedures/balance";
import { createCheckout } from "./procedures/create-checkout";
import { history } from "./procedures/history";
import { packs } from "./procedures/packs";

export const billingRouter = {
	packs,
	createCheckout,
	balance,
	history,
};

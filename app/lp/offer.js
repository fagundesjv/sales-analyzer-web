import { terms } from "../../lib/seat-pricing";
import { money } from "../../lib/operation";

// The hosted checkout and its advertised monthly price are configured together at build time.
const cents = Number(process.env.SALES_ANALYZER_MONTHLY_PRICE_CENTS);
const checkout = process.env.SALES_ANALYZER_CHECKOUT_URL;
const url = checkout && URL.canParse(checkout) ? new URL(checkout) : null;
const live = Number.isSafeInteger(cents) && cents > 0 && url?.protocol === "https:" && !url.username && !url.password;

export const monthlyOffer = {
  preview: !live,
  price: money(live ? cents : terms.seatPrice),
  checkoutUrl: live ? url.href : null,
};

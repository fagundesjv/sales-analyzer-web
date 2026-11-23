import { monthlyOffer } from "../offer";
import { PurchaseReview } from "./purchase-review";
import { TeamPurchase } from "./equipe/team-purchase";

export const metadata = { title: "Contratação · Sales Analyzer" };

export default function PurchasePage() {
  return monthlyOffer.preview ? <TeamPurchase /> : <PurchaseReview offer={monthlyOffer} />;
}

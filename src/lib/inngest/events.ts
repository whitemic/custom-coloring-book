/**
 * Inngest event type definitions.
 * Every event the system can emit is declared here for type-safe sends.
 */
export type InngestEvents = {
  "order/created": {
    data: {
      orderId: string;
    };
  };
  "library/book.assemble": {
    data: {
      purchaseId: string;
    };
  };
  "library/credit.purchase": {
    data: {
      /** UUID of the pending_credit_purchases record — authoritative source of email + credits. */
      pendingId: string;
    };
  };
  "page/regenerate": {
    data: {
      pageId: string;
      orderId: string;
      /** The buyer's email — used to refund credits on hard failure. */
      email: string;
    };
  };
};

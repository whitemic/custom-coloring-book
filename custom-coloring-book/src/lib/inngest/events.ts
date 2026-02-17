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
};

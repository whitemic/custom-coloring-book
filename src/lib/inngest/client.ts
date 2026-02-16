import { Inngest, EventSchemas } from "inngest";
import type { InngestEvents } from "./events";

export const inngest = new Inngest({
  id: "coloring-book-engine",
  schemas: new EventSchemas().fromRecord<InngestEvents>(),
});

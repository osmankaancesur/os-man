import { getDatabase } from "./database.js";
import { createNodeHandler } from "./node-handler.js";

export default createNodeHandler({
  getEnv: () => ({
    DB: getDatabase(),
  }),
  posts: __POST_SLUGS__,
});

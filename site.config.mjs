const origin = new URL(process.env.SITE_ORIGIN || "https://example.com");
if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash)
  throw Error("SITE_ORIGIN must be an HTTPS origin without a path or credentials.");
export default {
  title: "OS_MAN",
  description: "An open source interactive desktop for the web.",
  origin: origin.origin,
  author: "OS_MAN demo",
};

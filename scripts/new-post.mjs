import fs from "node:fs/promises";
const args = process.argv.slice(2),
  title = args.find((a) => !a.startsWith("--"));
if (!title) {
  console.error('Usage: npm run post -- "Your title" [--lang=tr]');
  process.exit(1);
}
const lang = args.includes("--lang=tr") ? "tr" : "en";
const slug = title
  .toLocaleLowerCase("en")
  .replace(/ı/g, "i")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
if (!slug) {
  console.error("Please use a title with letters or numbers.");
  process.exit(1);
}
const directory = "content/drafts";
await fs.mkdir(directory, { recursive: true });
const file = `${directory}/${slug}.md`;
try {
  await fs.writeFile(
    file,
    `---\ntitle: ${JSON.stringify(title)}\ndescription: "A short description of this post."\ndate: "${new Date().toISOString().slice(0, 10)}"\nlang: ${lang}\ntags: []\ndraft: true\n---\n\nStart writing here.\n`,
    { flag: "wx" },
  );
  console.log(
    `Created ${file}\nWrite your post, then set draft: false when it is ready.\nRun npm run build to refresh the preview.`,
  );
} catch (e) {
  console.error(
    e.code === "EEXIST" ? "A post with that slug already exists." : e.message,
  );
  process.exit(1);
}

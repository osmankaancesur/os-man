import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import sanitize from "sanitize-html";
export const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function parsePost(source, filename) {
  const { data, content } = matter(source);
  if (data.visibility === "private")
    throw Error(`Private post is in the public directory: ${filename}`);
  if (data.draft === true) return null;
  const slug = data.slug || path.basename(filename, ".md");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw Error(`Invalid slug in ${filename}`);
  if (
    typeof data.title !== "string" ||
    !data.title.trim() ||
    typeof data.description !== "string"
  )
    throw Error(`Title and description required: ${filename}`);
  const date =
    data.date instanceof Date
      ? data.date.toISOString().slice(0, 10)
      : data.date;
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw Error(`Invalid date: ${filename}`);
  const lang = data.lang || "en";
  if (!["en", "tr"].includes(lang))
    throw Error(`Unsupported language: ${filename}`);
  const tags = data.tags || [];
  if (
    !Array.isArray(tags) ||
    tags.some((t) => typeof t !== "string" || t.length > 40)
  )
    throw Error(`Invalid tags: ${filename}`);
  const html = sanitize(marked.parse(content), {
    allowedTags: sanitize.defaults.allowedTags.concat(["img"]),
    allowedAttributes: {
      ...sanitize.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height", "loading"],
      code: ["class"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    transformTags: {
      img: (_, attrs) => ({
        tagName: "img",
        attribs: { ...attrs, loading: "lazy" },
      }),
    },
  });
  return {
    slug,
    title: data.title,
    description: data.description,
    date,
    lang,
    tags,
    sample: data.sample === true,
    minutes: Math.max(1, Math.ceil(content.split(/\s+/).length / 200)),
    html,
  };
}
export async function readPosts(directory = "content/posts") {
  const names = (await fs.readdir(directory))
    .filter((n) => n.endsWith(".md"))
    .sort();
  const posts = (
    await Promise.all(
      names.map(async (name) =>
        parsePost(
          await fs.readFile(`${directory}/${name}`, "utf8"),
          name,
        ),
      ),
    )
  ).filter(Boolean);
  const slugs = new Set();
  for (const p of posts) {
    if (slugs.has(p.slug)) throw Error(`Duplicate slug: ${p.slug}`);
    slugs.add(p.slug);
  }
  return posts.sort(
    (a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug),
  );
}

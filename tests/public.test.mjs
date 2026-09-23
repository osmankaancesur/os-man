import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { buildSite } from "../scripts/build.mjs";
import { parsePost } from "../scripts/content.mjs";

test("private and draft posts cannot publish", () => {
  const base = '---\ntitle: Test\ndescription: Test\ndate: "2026-09-22"\n';
  assert.throws(() => parsePost(base + 'visibility: private\n---\nNo', "private.md"), /Private post/);
  assert.equal(parsePost(base + 'draft: true\n---\nNo', "draft.md"), null);
});

test("build contains only the reviewed sample post", async () => {
  await buildSite();
  const files = await fs.readdir("dist/client/posts");
  assert.deepEqual(files, ["about-this-demo"]);
  const catalog = JSON.parse(await fs.readFile("dist/client/posts.json", "utf8"));
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].sample, true);
});

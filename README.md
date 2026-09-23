# OS_MAN

An interactive desktop style website with a journal, terminal, guestbook, reactions, visual experiments, and appearance settings. This repository is a **public source edition** with a fresh Git history. It does not contain the original site's private writing, deployment link, database, or credentials.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:8002. The development server creates a local SQLite database in `.data/`. Run `npm test` for the included checks, or `npm run build` to generate `dist/client` and Vercel Build Output in `.vercel/output`.

## Customize

- Edit `site.config.mjs` and `socials.config.js` for your own title, description, and links.
- Set `SITE_ORIGIN` to your HTTPS origin before deployment. The default `https://example.com` is only a placeholder.
- Replace `content/posts/about-this-demo.md` with your own public posts. Use `npm run post -- "Your title"` to create an ignored draft in `content/drafts/`. When ready, move it to `content/posts/`, set `draft: false`, and review it before committing.
- Add media you own in `public/`. The audio playlist in `music-player.js` starts empty.
- Replace `content/pages/privacy.md` with a privacy notice that accurately reflects your deployment before enabling submissions.

The guestbook and reactions use SQLite locally. For Vercel deployments, create a separate Turso database, run `npm run db:migrate` with `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in a local `.env.local`, and set those variables in your own deployment. Do not connect this public repository to the original site's production project or database. No production records are included.

## Public source boundary

Only explicitly reviewed source files and a sample journal entry were copied. The original private repository and its history were not imported. Keep personal writing, unpublished posts, credentials, local databases, deployment metadata, and backups outside this repository. `.gitignore` prevents common accidental additions; review every commit before pushing.

## License

MIT. See [LICENSE](LICENSE). Add your own license information for any third party media you introduce.

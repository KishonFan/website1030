# Jianxiong Fan — Academic Website with CMS

The public design and existing content are retained from `KishonFan/website1025`. Publications and work cards are generated from editable JSON by a dependency-free Node.js build. Decap CMS 3.17.3 is vendored with its license and npm integrity metadata.

Read [后台启用指南.md](./后台启用指南.md) for the owner setup steps.

## Vercel deployment

The repository root contains `vercel.json`, `package.json` and `api/cms.js`. Vercel runs `node scripts/build.mjs`, serves `public/`, and deploys the OAuth handler as a Node.js function. The `public/` folder is generated and is not committed. There are no npm runtime dependencies.

CMS commits go to `main`, matching the GitHub repository's confirmed default branch. The existing Vercel production branch must also track `main` for CMS changes to reach the production domain automatically.

Required production environment variables:

- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`

Optional overrides are listed in `.env.example`. Default repository, branch, login owner and website URL are in `cms.config.json`. If the repository becomes private, use the `repo` OAuth scope instead of `public_repo` and sign in again to grant that scope.

## Content

- `content/publications.json`: publication/manuscript metadata and an editable manuscript section note.
- `content/works.json`: work cards, uploaded covers, categories and external destinations.
- `assets/uploads/`: CMS image uploads.
- Root `index.html` and `cv/index.html`: retained as authored.
- `publications/index.html` and `works/index.html`: retained page shells with explicit CMS content markers. The build replaces only the marked content in its generated output.

Article years and counts are calculated from visible published records. Manuscripts are a separate category, so accepting/publishing a manuscript is a category change rather than a duplicate entry. Work order follows the list order. The owner name is bolded automatically. HTML is escaped, links are limited to ordinary web URLs, and cover paths stay inside `assets/`.

## Authentication

The OAuth function uses a signed, short-lived, HttpOnly/Secure/SameSite state cookie and PKCE. It checks both the configured owner login and write access to the selected repository before handing the token to Decap. The popup handshake verifies both opener window and exact configured origin; callback pages are not cached and have a restrictive content security policy. The OAuth app client secret stays in Vercel environment variables. CMS content writes are performed through Decap's authenticated GitHub backend.

CMS hiding controls public page visibility only; it is not a private storage boundary in a public repository.

## Checks

```text
node scripts/build.mjs
node --test tests/content.test.mjs tests/auth.test.mjs
node scripts/preview.mjs
```

Unit checks cover content migration, automatic years/counts, category moves, visibility, original work destinations, unsafe content, state integrity/expiry, PKCE, owner/write-permission checks and credential handling. A real GitHub login and publication must be verified after the owner configures the OAuth app and deploys the production environment.

# Jianxiong Fan — Academic Website with CMS

The public design and existing content are retained from `KishonFan/website1030`. All four public pages and the shared profile are generated from editable JSON. Decap CMS 3.17.3 and the build-only Marked 18.1.2 parser are vendored with their licenses and integrity metadata; no npm install is required.

Read [后台启用指南.md](./后台启用指南.md) for the owner setup steps.

For an already working website, read [About-Me-CV后台升级说明.md](./About-Me-CV后台升级说明.md) to add the profile, About Me and CV forms without changing the login configuration.

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
- `content/journals.json`: shared journal covers, JCR quartiles and dated impact factors.
- `content/profile.json`: name, portrait, role, institution and contact details shared by all four pages.
- `content/about.json`: biography, research/technical skills, research interests and internal links.
- `content/cv.json`: CV introduction, education, research, projects, activities, achievements and PDF download path.
- `assets/uploads/`: uploaded images and replacement CV PDFs.
- All four HTML files retain the existing page shells, with explicit CMS markers. The generated output replaces the marked regions. Source HTML includes readable fallback content, while content edits belong in the JSON files or CMS.

Biography and CV descriptions use Markdown strings from the richtext editor. The build escapes raw HTML, disables text-embedded images and restricts link protocols. The downloaded CV PDF is uploaded separately; changing the webpage does not regenerate that PDF.

Article years and counts are calculated from visible published records. Manuscripts are a separate category, so accepting/publishing a manuscript is a category change rather than a duplicate entry. Work order follows the list order. The owner name is bolded automatically. HTML is escaped, links are limited to ordinary web URLs, and cover paths stay inside `assets/`.

## Authentication

The OAuth function uses a signed, short-lived, HttpOnly/Secure/SameSite state cookie and PKCE. It checks both the configured owner login and write access to the selected repository before handing the token to Decap. The popup handshake verifies both opener window and exact configured origin; callback pages are not cached and have a restrictive content security policy. The OAuth app client secret stays in Vercel environment variables. CMS content writes are performed through Decap's authenticated GitHub backend.

CMS hiding controls public page visibility only; it is not a private storage boundary in a public repository.

## Checks

```text
node scripts/build.mjs
node --test tests/*.test.mjs
node scripts/preview.mjs
```

Checks cover migration, shared profile updates on all four pages, new and reordered About Me/CV entries, visibility, PDF replacement, safe rich text, existing publication/work rendering and OAuth behavior. Local CMS forms can also be checked with the in-memory test backend. Production GitHub writes and Vercel deployment should be verified after uploading an update.

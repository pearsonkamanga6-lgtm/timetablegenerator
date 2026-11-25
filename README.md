# ZamBright Timetable Maker — cloud persistence candidate

**Status:** Reconstructed from the recovered September v2.1 HTML; not the unavailable November 25 generator. The generator itself is unchanged. Do not overwrite an existing newer timetable project with this package until its source has been compared. The empty starter is intentional: real school information belongs in a private backup or the protected database, not a public Git repository.

## Files to upload to a dedicated timetable repository
Extract the ZIP, and upload its contents directly to the repository root (keep `public/`, `src/`, `migrations/`, and `tests/` as separate subdirectories). Do not upload the separate real-school JSON backup to GitHub. Do not upload secrets.

## Cloudflare setup (Workers + D1, not static Pages)
1. Confirm whether a timetable Worker and D1 database already exist in your Cloudflare account. If they exist, identify them and verify the schema first; do not replace them or delete data. Use a separate test database and Worker until the new version is verified.
2. In a terminal in this folder, use Node 22 or later and run `npm install`. If you are deploying a new test Worker, adjust its name and database name in `wrangler.jsonc` to avoid any existing resource.
3. Authenticate using `npx wrangler login`. If creating a new database, run `npx wrangler d1 create zambright-timetable` (or the chosen test name). Put the actual database ID into `wrangler.jsonc`, replacing the placeholder. Keep the binding name `DB`.
4. Apply `npx wrangler d1 migrations apply zambright-timetable --remote` (replace the name if changed). Only apply to the verified target database.
5. Run `npx wrangler deploy`. The app fails closed until its password secret has been configured. Set it with `npx wrangler secret put TIMETABLE_PASSWORD` and use a strong unique password. Never commit it to GitHub. The login username is `school`. Use HTTPS in production. This prototype uses one shared school password; it does not provide separate teacher accounts or permissions.
6. Open the Worker URL reported by Cloudflare. In Backup, restore the separate JSON backup if appropriate, or the latest export from your actual working application. Confirm the data, then click Save to cloud. Do not overwrite existing cloud data without checking it first. On another device, sign in and click Open cloud timetable.
7. If connecting GitHub to Workers Builds, select the confirmed timetable repository and branch, with deploy command `npx wrangler deploy`. Configure the database and secret first. Do not connect an unrelated repository.

## Verification
`npm test` (Node 22+) runs six local SQL/HTTP-handler tests using Node SQLite, not Cloudflare D1 itself. Local test browser navigation was blocked by environment policy, so live browser integration is still pending. Use two browser profiles, open the same revision in both, save a change in A, then try to save in B. B must receive a conflict, keep its local data and be able to export a backup. Open the newer cloud copy on B only after reviewing local unsaved changes. Cloud saves are explicit; local edits are automatically stored in the browser when available. The application stores a single shared timetable per database. No automatic merge or revision history is implemented.

Cloudflare references:
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/d1/wrangler-commands/

The older recovered school backup has 114 allocations (310 periods), and is not the previously reported 624-period test. The corrected Physics allocations and current curriculum rules must still be reconciled with the missing November source or reimplemented separately before a production release.

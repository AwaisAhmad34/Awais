# Awais audit repair — staging candidate

Updated 21 October 2026. Repository: AwaisAhmad34/Awais; baseline 61769980e7d374fe8df3710af2776ec86ff8c4e1.

## Release status

Source repairs pass local tests, type checking and production build. **Not deployed or certified production-ready.** Existing data has not been migrated or restored. The live database and Firebase accounts have not been modified. The GitHub source matches the uploaded ZIP. Vercel metadata identifies project `awais`, but settings access returns HTTP 403 for team `bajwaahmedsaad345-1509`. The Vercel connection needs that team's grant. Firebase administrative access is also required for staging provisioning and rule deployment.

## Original security audit: every supplied finding

| Audit finding | Source remediation | Remaining release requirement |
| --- | --- | --- |
| Public Firestore read/write | Replaced public rules with active server-managed membership checks; legacy financial collections are owner-only. Unmatched paths and plaintext campus credentials are denied. | Test rules in emulator/staging and deploy them to the actual named database. Existing live rules were not changed. |
| Browser chooses its own session role | Removed identity extraction from headers/query/default administrator. All tenant routes require a verified Firebase ID token and a fresh server membership lookup. | Configure server credentials and verify real tokens, revocation and suspended memberships end to end. |
| Predictable HMAC fallback secret | This uploaded variant contains no HMAC session issuer. The replacement flow uses Firebase's verified ID tokens and introduces no fallback signing key. | If an older deployment issued HMAC tokens, retire its endpoints and rotate its old signing secret. This cannot be established from the ZIP alone. |
| Local passwords and demo admin login | Portal and core login now use Firebase Authentication and a server-managed membership. Removed demo quick fills, seed injection at login, local-password fallback and fallback campus login. Password spaces are preserved. | Provision owner/Auth memberships. Historical local/cloud user records and legacy campus credential management still need audited migration/redaction. Those tools do not provision Firebase users. |
| Vercel API routing uncertain | Added explicit exported Express entrypoint, Vercel API bridge and rewrites. Unknown APIs return JSON 404 instead of SPA HTML. PWA excludes API navigation fallback. | Verify the deployed Vercel function, server environment, route precedence and database connection in staging. No Vercel deploy occurred. |

## Completed source work

- Removed destructive CVT startup cleanup, old local-storage purges and automatic IndexedDB deletion. Preserved existing records.
- Firebase email/password sign-in and session restoration; server-managed active memberships; fresh verified token and membership on every API request. No browser role headers, demo passwords or default administrator login.
- Separated the tenant workspace from the lazily loaded legacy owner workspace. Client screens use the authenticated API and never load the legacy global ledger engine. Existing records stay in the owner-only legacy workspace until explicitly mapped and migrated.
- Added Firestore Admin transactions under `organizations/{clientId}` for clients, campuses, account heads, vouchers, petty cash, trash, invoices, periods and server audit records. Browser SDK access to these paths is denied by the supplied rules.
- Voucher numbering is reserved transactionally; updates require matching revision; account and campus dependencies, cent-balanced entries, role restrictions and period locks are enforced. Posted records are immutable. A correction currently requires a separate reversing journal; there is no automatic reversal workflow.
- Soft delete stores the original voucher and marks the record deleted in one transaction. Restore checks dependencies and retains original identity. Restoration covers vouchers; other legacy record types are not migrated.
- Cash updates use integer cents, transactionally maintained campus balances, idempotent request IDs and overspend rejection. The form retains its request ID when retrying the same failed submission.
- Monthly invoices snapshot active campuses and rates with unique month IDs. Closed periods reject new entries and cannot close over pending/draft vouchers.
- Report source rows are filtered by tenant/campus, with persistent owner-controlled report access. CSV escaping protects spreadsheet formula cells. Reports include ledger, period-movement trial balance, income/expense and petty-cash book. The trial balance is period movement, not a full opening/closing balance report. Print uses the browser dialog.
- Server account provisioning uses Firebase Authentication, scoped role delegation and membership metadata. Setup links are generated on explicit administrator action; no email is sent. Existing account linking, role updates and suspensions still need a management workflow.
- Fixed legacy recovery prechecks, fabricated empty-bin records, cross-client filtering, role alias escalation, monetary validation, missing context provider and false-success sync paths. Owner snapshot autosave waits for successful initial hydration and stops on logout.
- Added Vercel Express entrypoint, API rewrites, JSON API 404 handling and PWA API exclusions. Dependency lock resolves cleanly; stale Bun lock removed.
- Added read-only migration inventory script. It hashes the source and requires explicit campus/client mapping, reports ambiguity and refuses to overwrite its output. It does not import, delete or claim reconciliation of data.

## Validation evidence

Captured logs are in `validation/`.

- `npm test`: 19 Node test entries pass: 18 individually registered regressions plus the original suite containing 18 scenarios.
- Eight new durable repository tests cover invalid dates, tenant/campus denial, concurrent duplicate numbering, revision conflicts, approval restrictions, atomic recovery, cash retry/overspend, period locks and invoice snapshots. The transaction simulator enforces read-before-write and rollback. It is **not a Firestore emulator or live-database test**.
- `npm run typecheck`: passes.
- `npm run build`: passes; large legacy bundle warning remains. Legacy code is loaded separately from the tenant workspace.
- Browser interaction/accessibility/mobile QA, real Firebase sign-in and revoked-token tests, Firestore rules/emulator tests, Vercel deployed route tests and actual migration reconciliation have not run.
- Collections currently have a 5,000-record safety cap. Oversize reports return an explicit error rather than truncating; pagination is still required for larger deployments.

## Required before production release

1. Grant the Vercel connection access to the exact hosting team. Configure Firebase Admin credentials securely in staging; do not put private keys into chat or source control.
2. Export the named Firestore database, browser local storage/IndexedDB, attachments and recovery records. Preserve original exports separately. No live backup has been created by this patch.
3. Provision and test an owner account with `scripts/provisionMembership.ts`. Deploy/test rules against the configured named database, including direct unauthenticated and cross-client requests.
4. Inventory the actual export with explicit campus/client mapping using `scripts/migration/plan.ts`. Build a schema-specific import only after resolving ownership, credentials, opening balances and references. Reconcile record IDs/counts, debit/credit totals and cash balances in an isolated staging copy. There is no automated production import in this change.
5. Validate all report outputs, voucher entry/edit/delete/restore, cash retry, setup links, logout/reload, period locks and API routes in a browser. Check two real fixture organizations and all five roles. Legacy owner snapshot conflicts and offline editing remain unaddressed; the new tenant workspace requires an online server save.
6. Implement remaining requested feature coverage as separately verified work: full opening/closing reports, automatic reversal and multi-step approvals, non-voucher recovery, bank reconciliation, attachments, invoice payments, offline conflict resolution, keyboard navigation, and AI integrations. These are not certified by this patch.
7. Deploy frontend/backend/rules together only after staging acceptance and a tested data rollback. Do not restore public Firestore rules during rollback.

## Recovery claim

This patch repairs recovery logic and preserves data; it does not recreate deleted production data. Actual recovery needs a verified backup/export. “All bugs removed” and “all audit points recovered” are not supported by the current evidence.

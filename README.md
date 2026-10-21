# Awais financial workspace — repair candidate

See [AUDIT_REMEDIATION_REPORT.md](AUDIT_REMEDIATION_REPORT.md) for fixes, test evidence and production blockers. Do not deploy over existing data before backing it up and validating staging.

## Local validation

Use Node 22.12+ (production project uses Node 24).

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

Copy `.env.example` to `.env` and configure trusted Firebase Admin credentials locally or through the hosting secret manager. The frontend Firebase configuration and server project/named database must agree. Never expose an Admin private key through Vite variables.

## Data and authentication

Users sign in through Firebase Authentication with an active server-managed `memberships/{uid}` record. Provision the first owner using `scripts/provisionMembership.ts`; read its usage before execution. Existing legacy usernames/passwords do not become Firebase users automatically.

New workspaces store records transactionally below `organizations/{clientId}`. Only authenticated server routes access these paths. The supplied Firestore rules restrict legacy data to the approved owner. The owner-only legacy UI is preserved for existing records; it is a separate ledger and does not automatically migrate into organization workspaces.

## Read-only migration inventory

Prepare a JSON export and explicit mapping object such as `{"campus-original-id":"client-original-id"}`. Work on copies outside the repository; exports may contain sensitive data.

```sh
node --import tsx scripts/migration/plan.ts export.json campus-map.json plan.json
```

This only inventories IDs and mapping gaps, hashes its source, and writes a new plan file. It performs no database operations and cannot certify financial reconciliation or perform import. Resolve actual export schema and ownership before building/applying a staged migration.

## Deployment

`api/index.ts` exports Express for Vercel, with rewrites in `vercel.json`. Validate `/api/health`, authenticated `/api/tenants/context`, unauthenticated 401, unknown API 404, and actual durable transactions on a preview deployment. Static Vite hosting alone does not run the API.

Production rollout remains blocked by Vercel team access, Firebase provisioning/rule verification, actual data migration and browser acceptance testing. Keep the repair on a draft branch until those checks pass.

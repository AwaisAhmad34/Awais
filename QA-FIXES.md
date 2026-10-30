# QA remediation — 30 October 2026

This change is a **draft, not a production release**. The frontend fixes build
and pass the tests below. The proposed Firestore rules require an API migration
before database deployment; they must not be deployed as an isolated change.

## Implemented

- Sign-in tries exactly the submitted password once. It never registers users,
  attempts default passwords, creates memberships or infers an admin role from email.
- An existing, active, recognized membership is mandatory. Missing roles, tenant
  assignments or grants fail closed. Browser owner provisioning is disabled.
- The UI waits for a verified session and installs that exact profile, avoiding
  stale user-roster matching and the asynchronous add-user/login race.
- Sign-out clears the verified session and signs out Firebase. Late sign-in
  responses cannot restore an invalidated attempt. Sign-in has a 20-second timeout.
- Cloud sync requires a verified session and no longer silently selects Aplus
  for an unassigned identity. Default local account bootstrapping was removed.
- `all` expands to supported ledger module IDs; explicit empty grants stay empty.
- Login labels, error announcements, password-toggle names and busy feedback are
  accessible. Native dialogs provide focus containment, Escape and focus return.
- Sample voucher output is visibly marked SAMPLE, without approval, QR
  verification, audit-ID or official-signatory assertions. The selector offers
  an explicit sample choice, and JV is available in the studio.
- Voucher count terminology is corrected, and workbox-window is a direct dependency.

## Validation

- Production Vite/PWA build: passed (large-bundle warning remains).
- TypeScript check: passed.
- Node tests: 27 cases passed, including isolated authentication tests; the legacy
  tenant suite also logs 19 assertions. Run `node --import ./tests/loader.mjs --test
  --test-concurrency=1 tests/*.test.ts` (Node >=22.15).
- Built UI at localhost: input labels are associated; native help dialog opens
  with focus, closes with Escape and restores focus; invalid sign-in displays
  “The account or password is incorrect”; no mobile horizontal overflow at 375px.
- A valid production-account sign-in, financial writes, printed/exported PDFs
  and deployed database rules have NOT been verified with a disposable tenant.

## Required before release

1. Audit existing Firebase Auth users and memberships. The old code created
   unknown accounts and assigned them client-admin memberships, so repairing
   future sign-ins does not invalidate previously created memberships. Review
   the two synthetic identities used during QA as well as any other unapproved
   accounts. Revoke unauthorized sessions through a trusted administrator.
   No production identities were deleted or modified by this remediation.
2. Validate a legitimate owner and organization-admin membership using the
   trusted Admin SDK. Public browser bootstrap is intentionally unavailable.
3. Complete routing legacy browser writes through the existing authenticated
   `/api/tenants` handlers. The old cloud-sync adapter and several settings
   panels still use direct Firestore writes. The prototype rules deny these;
   deploying them before migration will block those operations. The API already
   validates tenant/campus scope, vouchers, cash balances, revisions and audit.
4. Verify backend Admin SDK configuration in the intended Vercel project without
   copying secrets into chat or committing them. Stage against a disposable
   organization and test all financial and settings flows with the restricted rules.
5. Run Firestore Emulator tests for unauthenticated requests, self-role changes,
   cross-tenant/campus reads and direct financial writes. No emulator verification
   or production Firebase deployment was performed in this change.
6. Release the frontend and the validated database/API migration together, then
   recheck the live URL. Vercel deployment alone does not publish Firestore rules.

The rules deliberately contain no browser write exceptions: allowing raw client
writes would bypass the existing server's financial transaction validation.
They are a reviewable containment prototype, not a claim that the whole legacy
application is ready for those rules yet.

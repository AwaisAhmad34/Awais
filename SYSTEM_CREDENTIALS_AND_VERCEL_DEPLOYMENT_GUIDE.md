# Master System Credentials & Vercel Production Deployment Directory

**Document Version:** 4.5-Production  
**Compliance Standard:** IAS-1 (Presentation of Financial Statements), GAAP Double-Entry, ISO 9001:2015  
**PDF Directory File:** [`public/SYSTEM_CREDENTIALS_DIRECTORY.pdf`](./public/SYSTEM_CREDENTIALS_DIRECTORY.pdf)

---

## 1. Master System Credentials Table

Use the following credentials to authenticate into the system across any deployment tier (Local, Cloud Run Preview, or Vercel Production):

| Clearance Tier | Username | Password | Organization / Branch | Scope & Authorized Modules |
| :--- | :--- | :--- | :--- | :--- |
| **Level 1: Platform Super Admin** *(Site Owner)* | `admin` | `admin` | Global Platform *(All Clients)* | **Full Root Control:** Platform Site Admin Hub (25 Modules), Client Organization Governance, Module Whitelisting, Global Recycle Bin, Permission Engine, Cloud Sync, Edit/Delete Any Main or Sub-Campus. |
| **Level 2: Client Super Admin** *(Aplus School System)* | `client.admin` | `campus` | Aplus School System | **Tenant Management:** Client Owner Management Hub, Sub-Campus Registration (within subscription limit), Campus Accountant Assignment, Consolidated P&L, Branch Ledger Inspection. |
| **Level 2: Client Super Admin** *(Apex Grammar Academy)* | `apex.admin` | `campus` | Apex Grammar Academy | **Tenant Management:** Isolated workspace for Apex Academy, Sub-Campus Management, Independent Cashbooks & Reporting. |
| **Level 3 & 4: Branch Accountant** *(Khiali Main Branch)* | `main` | `campus` | Khiali Campus *(Main Branch)* | **Branch Operations:** Cash & Bank Voucher Entry (BPV, BRV, CPV, CRV, JV), Petty Cash Imprest Float, 7-Day Physical Cash Vault Audit, Bank Reconciliation. |
| **Level 3 & 4: Branch Accountant** *(People's Colony Branch)* | `peoples` | `campus` | People's Colony Campus | **Branch Operations:** Daily Petty Cash Disbursements, Voucher Queue, Physical Vault Counting. |
| **Level 3 & 4: Branch Accountant** *(DC Colony Branch)* | `dc` | `campus` | DC Colony Campus | **Branch Operations:** Cash Reconciliation, Voucher Submissions, Local Branch Ledger. |
| **Level 3 & 4: Branch Accountant** *(Model Town Branch)* | `model` | `campus` | Model Town Campus | **Branch Operations:** Petty Cash Replenishments, Daily Voucher Submissions, Branch Reports. |
| **Level 3 & 4: Branch Accountant** *(Cantt Branch)* | `cantt` | `campus` | Cantt Campus | **Branch Operations:** Double-entry Bookkeeping, Vouchers, Local Balance Sheet. |
| **Level 3 & 4: Branch Accountant** *(City Campus Branch)* | `city` | `campus` | City Campus | **Branch Operations:** Daily Cashbook, Local Bank Reconciliations, Expense Logs. |
| **Level 5: Senior Internal Auditor** *(Compliance Officer)* | `auditor` | `campus` | Global Audit Review | **Read-Only Oversight:** Multi-Campus Transaction Ledgers, Bank Reconciliations, Physical Cash Vault Certificates, Forensic Audit Trail. |

---

## 2. Why Vercel Production Deployments Behave Differently

When you deploy this project to Vercel, the application runs on a fresh domain (e.g., `https://your-app.vercel.app`):

1. **Clean LocalStorage on First Visit:**
   In web browsers, `localStorage` is partitioned per origin domain. Visitors on your Vercel URL start with empty browser storage.
   - **Resolution Built-In:** The application includes an automated bootstrap module (`bootstrapProductionDefaultAccounts`) in `src/App.tsx` and `src/components/DynamicCampusLoginPortal.tsx`. Upon visiting the Vercel app, all master seed accounts (`admin`, `client.admin`, `apex.admin`, `auditor`, and branch accounts) are automatically initialized and verified immediately.

2. **Firebase Authorized Domains for Cloud Sync:**
   To synchronize data across multiple devices using Firebase Firestore:
   - Open your Firebase Console: Project `gen-lang-client-0191400825`.
   - Go to **Authentication** > **Settings** > **Authorized Domains**.
   - Click **Add Domain** and enter your Vercel domain (e.g., `your-app.vercel.app`).
   - Click **Save**.

3. **Offline-First PWA & IndexedDB:**
   The application registers a Service Worker and utilizes IndexedDB persistence so that branch accountants can record transactions even during intermittent internet connectivity.

---

## 3. Executive Dashboard & Admin Governance Architecture

As specified by the institutional governance rules:

- **Executive Financial Dashboard (`dashboard`):**
  - Reserved **strictly** for high-level charts, institutional performance telemetry, revenue vs expense graphs, petty cash monthly category breakdowns, and campus budget variance gauges.
  - No administrative clutter, sync buttons, or access matrix tools appear on this screen.

- **Platform Site Admin Hub (`PlatformSiteAdminHub`):**
  - Exclusively accessible to the root **Site Owner** (`admin`).
  - Contains all 25 governance modules:
    - Section 07: Permission Engine & 5-Tier RBAC
    - Section 08: Configurable Approval Matrix
    - Section 10: Cloud Sync Center (Push & Load Cloud)
    - Section 14: Global Recycle Bin & Restore Deleted COA
    - Section 16: Bulk Voucher Management & Queue Approval
    - Section 18: AI Expense Category Suggester
    - Section 20: Forensic Secure Audit Trail
    - Section 22: System Configuration & Institutional Settings

---

## 4. One-Click PDF Download Inside the App

Users on the sign-in screen can:
1. Click **"Production Credentials & Login Directory"** on the login page to expand the credentials drawer.
2. Click **"Download Credentials PDF"** to immediately save the offline print-ready copy of `SYSTEM_CREDENTIALS_DIRECTORY.pdf`.
3. Use the one-click **"Auto-Fill"** buttons to log in instantly as any role.

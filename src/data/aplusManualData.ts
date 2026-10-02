export interface ManualSection {
  number: number;
  id: string;
  title: string;
  category:
    | 'Foundations & Scope'
    | 'Users, Auth & Campus'
    | 'Voucher Management'
    | 'Petty Cash Control'
    | 'Workflows & Reporting'
    | 'Audit, Security & Procedures'
    | 'Templates, FAQs & Blueprint';
  summary: string;
  paragraphs?: string[];
  subSections?: {
    heading: string;
    text?: string;
    bullets?: string[];
  }[];
  bullets?: string[];
  table?: {
    headers: string[];
    rows: string[][];
    alignRightCols?: number[];
  };
  formula?: string;
  highlightBox?: {
    title: string;
    lines: string[];
    tone?: 'blue' | 'emerald' | 'amber' | 'slate';
  };
  flowSteps?: string[];
}

export const APLUS_MANUAL_SECTIONS: ManualSection[] = [
  {
    number: 1,
    id: 'sec-1-introduction',
    title: '1. Introduction',
    category: 'Foundations & Scope',
    summary: 'Centralized financial management solution designed to manage day-to-day financial transactions across multiple school campuses.',
    paragraphs: [
      'The Aplus School System Multi-Campus Voucher & Petty Cash Management System is a centralized financial management solution designed to manage day-to-day financial transactions across multiple school campuses.',
      'The purpose of the system is to replace manual registers, paper-based vouchers, scattered Excel sheets, and informal expense records with a structured digital system.',
      'The system is particularly useful for an educational organization operating multiple campuses because each campus may have its own routine expenses while management requires a consolidated financial view.',
    ],
    bullets: [
      'Recording expenses',
      'Preparing payment vouchers',
      'Managing petty cash',
      'Maintaining campus-wise financial records',
      'Tracking income and expenses',
      'Monitoring transactions',
      'Maintaining financial history',
      'Preparing reports',
      'Reviewing and approving financial transactions',
      'Maintaining accountability of cash usage',
    ],
  },
  {
    number: 2,
    id: 'sec-2-purpose',
    title: '2. Purpose of the System',
    category: 'Foundations & Scope',
    summary: 'Centralized financial management, campus-wise record keeping, structured vouchers, petty cash control, and full accountability.',
    paragraphs: [
      'The primary purpose of the system is to provide an organized and transparent method of recording and monitoring financial transactions.',
    ],
    subSections: [
      {
        heading: '2.1 Centralized Financial Management',
        text: 'All financial transactions can be maintained through one centralized system rather than separate registers for each campus.',
      },
      {
        heading: '2.2 Campus-Wise Record Keeping',
        text: 'Transactions can be associated with their relevant campus so that management can determine how much money has been spent by each campus.',
      },
      {
        heading: '2.3 Voucher Management',
        text: 'Financial transactions can be recorded through properly structured vouchers containing:',
        bullets: [
          'Voucher number',
          'Date',
          'Campus',
          'Expense category',
          'Description',
          'Amount',
          'Payee',
          'Payment method',
          'Supporting information',
          'Approval status',
        ],
      },
      {
        heading: '2.4 Petty Cash Control',
        text: 'The system helps maintain records of small day-to-day expenses. Examples include:',
        bullets: [
          'Stationery',
          'Tea/refreshments',
          'Local transportation',
          'Minor maintenance',
          'Cleaning materials',
          'Printing & Photocopying',
          'Small repairs & Office supplies',
        ],
      },
      {
        heading: '2.5 Accountability',
        text: 'Each transaction has sufficient information to identify:',
        bullets: [
          'Who entered it',
          'When it was entered',
          'Which campus it belongs to',
          'Why the payment was made',
          'How much was paid',
          'Who received the payment',
        ],
      },
    ],
  },
  {
    number: 3,
    id: 'sec-3-scope',
    title: '3. Scope of the System',
    category: 'Foundations & Scope',
    summary: 'Covers Financial Management, Campus Management, Reporting, and Administration across all school branches.',
    paragraphs: [
      'The system covers financial activities related to multiple school campuses across four major operational domains:',
    ],
    subSections: [
      {
        heading: 'Financial Management',
        bullets: [
          'Expense recording',
          'Payment recording',
          'Voucher preparation',
          'Cash management',
          'Petty cash management',
          'Transaction history',
        ],
      },
      {
        heading: 'Campus Management',
        bullets: [
          'Campus identification',
          'Campus-wise transactions',
          'Campus-wise expense reporting',
          'Consolidated reporting',
        ],
      },
      {
        heading: 'Reporting',
        bullets: [
          'Daily expense reports',
          'Monthly expense reports',
          'Campus-wise reports',
          'Category-wise reports',
          'Voucher reports',
          'Petty cash reports',
          'Financial summaries',
        ],
      },
      {
        heading: 'Administration',
        bullets: [
          'User management',
          'Access control',
          'Transaction monitoring',
          'Data verification',
          'System configuration',
        ],
      },
    ],
  },
  {
    number: 4,
    id: 'sec-4-users',
    title: '4. System Users',
    category: 'Users, Auth & Campus',
    summary: 'Role hierarchy covering Super Administrator, Administrator, Finance User, Campus User, and Management.',
    paragraphs: [
      'Different users have distinct responsibilities and access boundaries within the Aplus School System.',
    ],
    subSections: [
      {
        heading: '4.1 Super Administrator',
        text: 'The Super Administrator has overall control of the system.',
        bullets: [
          'Creating users & managing user permissions',
          'Managing campuses & expense categories',
          'Monitoring transactions & reviewing reports',
          'Managing system settings & maintaining financial controls',
        ],
      },
      {
        heading: '4.2 Administrator',
        text: 'The Administrator manages routine system operations.',
        bullets: [
          'Maintaining campus information & managing categories',
          'Reviewing transactions & generating reports',
          'Monitoring vouchers & managing routine financial records',
        ],
      },
      {
        heading: '4.3 Finance User',
        text: 'The Finance User is responsible for entering and maintaining financial transactions.',
        bullets: [
          'Entering expenses & preparing vouchers',
          'Recording payments & maintaining petty cash',
          'Checking transaction details & generating financial reports',
        ],
      },
      {
        heading: '4.4 Campus User',
        text: 'A campus-level user records transactions relating to a specific campus.',
        bullets: [
          'Recording campus expenses & preparing expense requests',
          'Entering petty cash transactions',
          'Checking campus transactions & providing supporting information',
        ],
      },
      {
        heading: '4.5 Management',
        text: 'Management uses the system to review consolidated reports and summaries rather than day-to-day entry:',
        bullets: [
          'Total expenses & campus expenses',
          'Expense categories',
          'Pending & approved transactions',
          'Petty cash balances & monthly financial activity',
        ],
      },
    ],
  },
  {
    number: 5,
    id: 'sec-5-login',
    title: '5. Login and Authentication',
    category: 'Users, Auth & Campus',
    summary: 'Secure authentication process, role-based routing, and institutional security principles.',
    paragraphs: [
      'The system begins with a secure login screen. After successful authentication, the user is directed to the appropriate dashboard according to assigned permissions.',
    ],
    subSections: [
      {
        heading: 'Login Process',
        bullets: [
          '1. User identification (Email / Role selection)',
          '2. Password verification',
          '3. Authentication validation',
          '4. Access granted according to assigned campus & module permissions',
        ],
      },
      {
        heading: 'Security Principles',
        bullets: [
          'Keep passwords confidential',
          'Avoid sharing accounts',
          'Log out after completing work',
          'Use only assigned permissions',
          'Immediately report suspicious activity',
        ],
      },
    ],
  },
  {
    number: 6,
    id: 'sec-6-dashboard',
    title: '6. Dashboard',
    category: 'Users, Auth & Campus',
    summary: 'Central executive control panel providing real-time KPIs for expenses, vouchers, petty cash, and campus comparisons.',
    paragraphs: [
      'The dashboard serves as the central control panel, providing management with a quick overview of financial activity across all campuses.',
    ],
    subSections: [
      {
        heading: 'Total Expenses',
        text: 'Displays the total amount of recorded expenses for the selected period.',
      },
      {
        heading: 'Total Vouchers',
        text: 'Shows the total number of vouchers created across BPV, BRV, CPV, CRV, and JV.',
      },
      {
        heading: 'Pending Vouchers',
        text: 'Displays vouchers waiting for review or approval.',
      },
      {
        heading: 'Approved Vouchers',
        text: 'Shows approved and posted transactions.',
      },
      {
        heading: 'Petty Cash',
        text: 'Displays available petty cash float, disbursements, and net cash in safe.',
      },
      {
        heading: 'Campus Summary',
        text: 'Provides a side-by-side comparison of financial activity across campuses.',
      },
    ],
  },
  {
    number: 7,
    id: 'sec-7-campus-management',
    title: '7. Campus Management',
    category: 'Users, Auth & Campus',
    summary: 'Unique campus identification codes (APS-01 to APS-04 / CVT / MC / GHKR / KHIALI) and administrative profiles.',
    paragraphs: [
      'Because the system is designed for multiple campuses, campus management is a foundational component. Each campus maintains a unique identification code.',
    ],
    table: {
      headers: ['Campus', 'Standard Code', 'Active System Branch Equivalent'],
      rows: [
        ['Main Campus', 'APS-01', 'A+ School System (Khiali Campus) — CAMPUS-KHIALI'],
        ['Campus 2', 'APS-02', 'CVT Campus — CVT'],
        ['Campus 3', 'APS-03', 'Master City Campus — MC'],
        ['Campus 4', 'APS-04', 'Ghakhar Campus — GHKR'],
      ],
    },
    bullets: [
      'Campus name & Campus code',
      'Address & Contact number',
      'Campus administrator / accountant name',
      'Status (Active / Inactive) & Login access control',
      'Imprest Petty Cash Float allocation',
    ],
  },
  {
    number: 8,
    id: 'sec-8-voucher-management',
    title: '8. Voucher Management',
    category: 'Voucher Management',
    summary: 'Formal documentation of financial transactions through structured payment, receipt, and journal vouchers.',
    paragraphs: [
      'Voucher management is one of the core functions of the system. A voucher provides formal documentation of a financial transaction.',
      '8.1 Voucher Creation: A user creates a voucher whenever a financial transaction needs to be recorded.',
    ],
    bullets: [
      'Voucher number',
      'Voucher date',
      'Campus',
      'Expense category / Account Head',
      'Description / Narration',
      'Amount (Debit & Credit)',
      'Payment method (Cash / Bank / Cheque)',
      'Recipient / Payee',
      'Remarks & Supporting document reference',
      'Entered by (Prepared By)',
      'Approval status',
    ],
  },
  {
    number: 9,
    id: 'sec-9-voucher-number',
    title: '9. Voucher Number',
    category: 'Voucher Management',
    summary: 'Sequential, non-duplicated identification numbering (e.g., APS-EXP-00001, BPV-2026-001) for audit traceability.',
    paragraphs: [
      'Every voucher must have a unique identification number. The numbering system allows transactions to be located easily and prevents duplication.',
      'A proper numbering sequence also improves audit and record-management processes.',
    ],
    highlightBox: {
      title: 'Standard Voucher Numbering Examples',
      lines: [
        'Expense / Petty Cash Format: APS-EXP-00001',
        'Bank Payment Voucher: BPV-2026-001',
        'Bank Receipt Voucher: BRV-2026-001',
        'Cash Payment Voucher: CPV-2026-001',
        'Cash Receipt Voucher: CRV-2026-001',
      ],
      tone: 'blue',
    },
  },
  {
    number: 10,
    id: 'sec-10-voucher-date',
    title: '10. Voucher Date',
    category: 'Voucher Management',
    summary: 'Accurate transaction dating governing daily/monthly expenses, financial periods, and cash movements.',
    paragraphs: [
      'The transaction date must be entered accurately. Users should avoid entering incorrect or approximate dates because the voucher date directly determines:',
    ],
    bullets: [
      'Daily expenses',
      'Monthly expenses',
      'Financial period assignment',
      'Cash movement chronology',
      'Reporting period inclusion',
    ],
  },
  {
    number: 11,
    id: 'sec-11-expense-category',
    title: '11. Expense Category',
    category: 'Voucher Management',
    summary: 'Standardized institutional expense categories mapped to the 157 official Chart of Accounts heads.',
    paragraphs: [
      'Each expense must be assigned to an appropriate standardized category to avoid inconsistent reporting:',
    ],
    bullets: [
      'Staff Food & Refreshments',
      'Stationery',
      'Printing & Photocopy',
      'Maintenance & Repairs',
      'Electricity, Water & Gas Utilities',
      'Internet & Telephone',
      'Transportation & Fuel (Bus / Van / Generator)',
      'Cleaning Materials',
      'Office Supplies & School Supplies',
      'Guest Entertainment',
      'Miscellaneous Operational Overheads',
    ],
  },
  {
    number: 12,
    id: 'sec-12-expense-description',
    title: '12. Expense Description',
    category: 'Voucher Management',
    summary: 'Clear narration answering What was purchased, Why it was purchased, and For which campus/department.',
    paragraphs: [
      'The description explains why the money was spent. Detailed descriptions improve transparency and allow auditors to verify transactions without ambiguity.',
      'A good description must answer three questions: What was purchased? Why was it purchased? For which campus or department?',
    ],
    highlightBox: {
      title: 'Narration Quality Standard',
      lines: [
        '✓ Recommended: "Stationery purchased for administrative office use."',
        '✗ Avoid: "Stationery."',
      ],
      tone: 'emerald',
    },
  },
  {
    number: 13,
    id: 'sec-13-amount',
    title: '13. Amount',
    category: 'Voucher Management',
    summary: 'Numeric validation ensuring positive, non-zero PKR values and balanced double-entry totals.',
    paragraphs: [
      'The amount must be entered accurately in PKR (Pakistani Rupees). The system validates that:',
    ],
    bullets: [
      'Amount is numeric',
      'Amount is greater than zero (> 0)',
      'Currency is correctly defined (e.g., PKR 5,500)',
      'No accidental negative value is entered',
      'Total Debit equals Total Credit (Σ Dr = Σ Cr) for ledger vouchers',
    ],
  },
  {
    number: 14,
    id: 'sec-14-payee',
    title: '14. Payee / Recipient',
    category: 'Voucher Management',
    summary: 'Identification of the supplier, employee, vendor, or utility provider receiving payment.',
    paragraphs: [
      'The payee is the person or organization receiving payment. Maintaining payee information makes financial records easier to verify during audits.',
    ],
    bullets: [
      'Supplier / Bookshop',
      'Employee / Faculty Member',
      'Vendor / Contractor',
      'Transport Provider',
      'Maintenance Worker / Technician',
      'Restaurant / Caterer',
      'Utility Provider (GEPCO, SNGPL, PTCL, WASA)',
    ],
  },
  {
    number: 15,
    id: 'sec-15-payment-method',
    title: '15. Payment Method',
    category: 'Voucher Management',
    summary: 'Classification by Cash, Bank Transfer, Cheque, Online Transfer, or Imprest Petty Cash.',
    paragraphs: [
      'The system categorizes transactions according to payment method to streamline cash book and bank reconciliation:',
    ],
    bullets: [
      'Cash (via CPV / CRV / Petty Cash)',
      'Bank Transfer (via BPV / BRV)',
      'Cheque (with Cheque No. reference)',
      'Online Transfer / IBFT',
      'Other approved institutional method',
    ],
  },
  {
    number: 16,
    id: 'sec-16-voucher-status',
    title: '16. Voucher Status',
    category: 'Voucher Management',
    summary: 'Lifecycle status definitions: Draft, Submitted, Pending, Approved, Rejected, Paid, Posted, and Cancelled.',
    paragraphs: [
      'A clear voucher status system prevents confusion and enforces financial authorization controls:',
    ],
    subSections: [
      {
        heading: 'Draft',
        text: 'The voucher has been created but is not yet finalized.',
      },
      {
        heading: 'Submitted / Pending',
        text: 'The voucher has been submitted for finance/management review.',
      },
      {
        heading: 'Approved',
        text: 'The transaction has been reviewed and approved by an authorized officer.',
      },
      {
        heading: 'Rejected',
        text: 'The transaction has been rejected with a recorded reason.',
      },
      {
        heading: 'Paid / Posted',
        text: 'Payment has been completed and finalized in the General Ledger.',
      },
      {
        heading: 'Cancelled',
        text: 'The transaction has been voided/cancelled.',
      },
    ],
  },
  {
    number: 17,
    id: 'sec-17-petty-cash-management',
    title: '17. Petty Cash Management',
    category: 'Petty Cash Control',
    summary: 'Digital record of small routine campus expenses using the core Petty Cash Balance Formula.',
    paragraphs: [
      'Petty cash is used for small routine expenses across school campuses. The system maintains a real-time digital record of petty cash movement.',
    ],
    formula: 'Opening Balance + Cash Received − Cash Spent = Closing Balance',
    highlightBox: {
      title: 'Petty Cash Calculation Example',
      lines: [
        'Opening Balance: PKR 20,000',
        'Cash Received (Replenishment): + PKR 10,000',
        'Expenses (Cash Spent): − PKR 7,500',
        'Closing Balance: = PKR 22,500',
      ],
      tone: 'emerald',
    },
  },
  {
    number: 18,
    id: 'sec-18-petty-cash-transactions',
    title: '18. Petty Cash Transactions',
    category: 'Petty Cash Control',
    summary: 'Complete petty cash transaction history capturing date, voucher number, category, amount, recipient, and campus.',
    paragraphs: [
      'Every petty cash transaction must be recorded to build an unbroken, auditable transaction history. Each entry includes:',
    ],
    bullets: [
      'Date',
      'Voucher number (e.g., PCV-2026-001 / APS-EXP-00001)',
      'Description / Narration',
      'Category / Expense Head',
      'Amount (PKR)',
      'Recipient / Payee',
      'Campus',
      'Receipt No. & Remarks',
    ],
  },
  {
    number: 19,
    id: 'sec-19-petty-cash-reconciliation',
    title: '19. Petty Cash Reconciliation',
    category: 'Petty Cash Control',
    summary: 'Periodic verification comparing System Balance against Physical Cash Available in the campus safe.',
    paragraphs: [
      'Petty cash must be periodically reconciled. The reconciliation process involves comparing the System Balance with Physical Cash Available in the drawer/safe.',
      'If there is a difference, the petty cash transaction history must be reviewed immediately.',
    ],
    highlightBox: {
      title: 'Physical Cash Reconciliation Example',
      lines: [
        'System Balance: PKR 25,000',
        'Physical Cash Available: PKR 25,000',
        'Difference: PKR 0 (Balanced & Verified)',
      ],
      tone: 'blue',
    },
  },
  {
    number: 20,
    id: 'sec-20-expense-recording-process',
    title: '20. Expense Recording Process',
    category: 'Workflows & Reporting',
    summary: '10-stage traceable workflow from expense occurrence to payment and report update.',
    paragraphs: [
      'The recommended end-to-end expense recording workflow creates a fully traceable financial record:',
    ],
    flowSteps: [
      'Expense Occurs',
      'User Collects Supporting Information',
      'Expense Entered into System',
      'Voucher Created',
      'Voucher Submitted',
      'Review',
      'Approval',
      'Payment',
      'Transaction Marked as Paid / Posted',
      'Report Updated',
    ],
  },
  {
    number: 21,
    id: 'sec-21-daily-expense-management',
    title: '21. Daily Expense Management',
    category: 'Workflows & Reporting',
    summary: 'End-of-day verification checklist for campus accountants and finance officers.',
    paragraphs: [
      'At the end of each working day, the responsible finance user must review all transactions to confirm:',
    ],
    bullets: [
      'All expenses for the day have been entered',
      'Correct campus has been selected on every voucher',
      'Correct PKR amount has been entered',
      'Correct expense category / account head has been selected',
      'Voucher information (payee, description, reference) is complete',
      'Supporting bills/invoices are available',
      'No duplicate transaction exists',
    ],
  },
  {
    number: 22,
    id: 'sec-22-monthly-financial-management',
    title: '22. Monthly Financial Management',
    category: 'Workflows & Reporting',
    summary: 'Month-end executive review covering total expenses, campus breakdown, categories, petty cash, and pending items.',
    paragraphs: [
      'At the end of every month, management reviews the consolidated financial data across five pillars:',
    ],
    subSections: [
      {
        heading: 'Total Expenses',
        text: 'Total institutional expenses incurred during the month.',
      },
      {
        heading: 'Campus-Wise Expenses',
        text: 'Amount spent by each individual school campus.',
      },
      {
        heading: 'Category-Wise Expenses',
        text: 'Amount spent under each standardized accounting head.',
      },
      {
        heading: 'Petty Cash',
        text: 'Opening balance, cash received (replenishments), expenses, and closing balance.',
      },
      {
        heading: 'Outstanding Transactions',
        text: 'Transactions that remain pending review or approval.',
      },
    ],
  },
  {
    number: 23,
    id: 'sec-23-campus-wise-reporting',
    title: '23. Campus-Wise Reporting',
    category: 'Workflows & Reporting',
    summary: 'Comparative analysis of monthly expenditure across individual school campuses.',
    paragraphs: [
      'One of the major advantages of a multi-campus system is the ability to analyze each campus separately and investigate branch-level financial activity.',
    ],
    table: {
      headers: ['Campus', 'Monthly Expense'],
      rows: [
        ['Main Campus', 'PKR 150,000'],
        ['Campus 2', 'PKR 125,000'],
        ['Campus 3', 'PKR 98,000'],
        ['Campus 4', 'PKR 112,000'],
      ],
      alignRightCols: [1],
    },
  },
  {
    number: 24,
    id: 'sec-24-category-wise-reporting',
    title: '24. Category-Wise Reporting',
    category: 'Workflows & Reporting',
    summary: 'Breakdown of spending by expense category to support institutional budgeting and cost control.',
    paragraphs: [
      'Category-wise reports identify exactly where money is being spent and support budgeting and financial planning.',
    ],
    table: {
      headers: ['Category', 'Amount'],
      rows: [
        ['Stationery', 'PKR 45,000'],
        ['Maintenance', 'PKR 65,000'],
        ['Staff Food', 'PKR 35,000'],
        ['Transportation', 'PKR 20,000'],
        ['Printing', 'PKR 15,000'],
      ],
      alignRightCols: [1],
    },
  },
  {
    number: 25,
    id: 'sec-25-date-filters',
    title: '25. Date Filters',
    category: 'Workflows & Reporting',
    summary: 'Flexible period filtering (Today, Yesterday, Week, Month, Fiscal Year, Custom Date Range).',
    paragraphs: [
      'Financial reports and ledgers support date-based filtering so management can analyze any specific financial period (for example: 01 September 2026 – 30 September 2026).',
    ],
    bullets: [
      'Today & Yesterday',
      'Current week & Previous week',
      'Current month & Previous month',
      'Active Fiscal Year',
      'Custom date range (Start Date to End Date)',
    ],
  },
  {
    number: 26,
    id: 'sec-26-search-function',
    title: '26. Search Function',
    category: 'Workflows & Reporting',
    summary: 'Instant multi-criteria search across voucher numbers, dates, campuses, categories, payees, and statuses.',
    paragraphs: [
      'A fast search facility allows users to locate specific transactions immediately, eliminating the need to manually search through physical registers.',
    ],
    bullets: [
      'Voucher number',
      'Date',
      'Campus',
      'Category / Account Code',
      'Payee / Recipient',
      'Amount',
      'Description / Narration',
      'Approval Status',
    ],
  },
  {
    number: 27,
    id: 'sec-27-reports',
    title: '27. Reports',
    category: 'Workflows & Reporting',
    summary: 'Suite of 9 core institutional reports including Daily/Monthly Expense, Campus, Category, Voucher, and Petty Cash reports.',
    paragraphs: [
      'The financial system provides comprehensive printable and PDF-exportable reports:',
    ],
    subSections: [
      { heading: 'Daily Expense Report', text: 'Shows expenses recorded on a selected day.' },
      { heading: 'Monthly Expense Report', text: 'Shows all expenses during a selected month.' },
      { heading: 'Campus Expense Report', text: 'Shows transactions for a selected campus.' },
      { heading: 'Category Report', text: 'Shows expenses according to categories / account heads.' },
      { heading: 'Voucher Report', text: 'Provides a register of vouchers (BPV, BRV, CPV, CRV, JV).' },
      { heading: 'Petty Cash Report', text: 'Shows petty cash float, disbursements, and replenishments.' },
      { heading: 'Pending Voucher Report', text: 'Shows transactions awaiting approval.' },
      { heading: 'Approved Voucher Report', text: 'Shows approved transactions.' },
      { heading: 'Payment Report', text: 'Shows completed payments.' },
    ],
  },
  {
    number: 28,
    id: 'sec-28-financial-summary',
    title: '28. Financial Summary',
    category: 'Workflows & Reporting',
    summary: 'Executive cash position summary: Opening Cash + Total Receipts − Total Expenses = Closing Balance.',
    paragraphs: [
      'A financial summary provides management with an immediate overall liquidity view.',
    ],
    highlightBox: {
      title: 'Executive Financial Summary Example',
      lines: [
        'Opening Cash: PKR 500,000',
        'Total Receipts: + PKR 200,000',
        'Total Expenses: − PKR 325,000',
        'Closing Balance: = PKR 375,000',
      ],
      tone: 'emerald',
    },
  },
  {
    number: 29,
    id: 'sec-29-data-accuracy',
    title: '29. Data Accuracy',
    category: 'Audit, Security & Procedures',
    summary: 'Pre-submission verification standards for date, amount, campus, category, payee, and payment method.',
    paragraphs: [
      'Financial software depends heavily on accurate data entry. Incorrect data results in inaccurate reports. Before submitting a transaction, users must verify:',
    ],
    bullets: [
      'Date',
      'Amount',
      'Campus',
      'Category / Account Head',
      'Description / Narration',
      'Payee',
      'Voucher number',
      'Payment method',
    ],
  },
  {
    number: 30,
    id: 'sec-30-duplicate-transactions',
    title: '30. Duplicate Transactions',
    category: 'Audit, Security & Procedures',
    summary: 'Prevention of double-entry inflation by searching existing records prior to posting.',
    paragraphs: [
      'Duplicate transactions must be strictly avoided. If the same PKR 5,000 expense is entered twice, the system will report PKR 10,000 instead of the actual PKR 5,000 expense.',
      'Users must search existing records before entering a transaction whenever there is any uncertainty.',
    ],
    highlightBox: {
      title: 'Duplicate Entry Impact',
      lines: [
        'Actual Expense: PKR 5,000',
        'Recorded Twice in Error: PKR 10,000 (Overstated by PKR 5,000)',
      ],
      tone: 'amber',
    },
  },
  {
    number: 31,
    id: 'sec-31-approval-system',
    title: '31. Approval System',
    category: 'Audit, Security & Procedures',
    summary: 'Tiered approval workflow (Created → Submitted → Reviewed → Approved → Paid) by expense size.',
    paragraphs: [
      'A structured approval process improves financial control across all campuses.',
    ],
    flowSteps: ['Created', 'Submitted', 'Reviewed', 'Approved', 'Paid'],
    subSections: [
      {
        heading: 'Small Expense Tier',
        text: 'Campus administrator approval.',
      },
      {
        heading: 'Medium Expense Tier',
        text: 'Campus administrator + Finance approval.',
      },
      {
        heading: 'Large Expense Tier',
        text: 'Executive Management / Super Administrator approval.',
      },
    ],
  },
  {
    number: 32,
    id: 'sec-32-audit-trail',
    title: '32. Audit Trail',
    category: 'Audit, Security & Procedures',
    summary: 'Immutable activity logging recording who created, modified, or approved every transaction and when.',
    paragraphs: [
      'An audit trail records all important actions performed within the system. It identifies:',
    ],
    bullets: [
      'Who created a voucher',
      'Who modified a transaction',
      'Who approved or rejected it',
      'When the action occurred (exact timestamp)',
      'What status and monetary value it had',
    ],
  },
  {
    number: 33,
    id: 'sec-33-user-permissions',
    title: '33. User Permissions',
    category: 'Audit, Security & Procedures',
    summary: 'Role-Based Access Control (RBAC) permission matrix for Admin, Finance, Campus User, and Management.',
    paragraphs: [
      'Users only receive permissions required for their responsibilities:',
    ],
    table: {
      headers: ['Function', 'Admin', 'Finance', 'Campus User', 'Management'],
      rows: [
        ['View Dashboard', '✓', '✓', '✓', '✓'],
        ['Create Voucher', '✓', '✓', '✓', 'Optional'],
        ['Approve Voucher', '✓', '✓', 'Limited', '✓'],
        ['Manage Users', '✓', '—', '—', '—'],
        ['View Reports', '✓', '✓', 'Campus Only', '✓'],
        ['Manage Campuses', '✓', '—', '—', '—'],
      ],
    },
  },
  {
    number: 34,
    id: 'sec-34-data-security',
    title: '34. Data Security',
    category: 'Audit, Security & Procedures',
    summary: 'Protection of sensitive school financial records via RBAC, strong credentials, backups, and audit logs.',
    paragraphs: [
      'Financial information is sensitive and must be protected through institutional security practices:',
    ],
    bullets: [
      'Strong passwords & individual user accounts',
      'Role-based permissions & campus isolation',
      'Secure authentication',
      'Regular automated & cloud backups',
      'Immutable audit logs',
      'Restricted administrative access',
      'Secure hosting & regular security updates',
    ],
  },
  {
    number: 35,
    id: 'sec-35-backup-and-recovery',
    title: '35. Backup and Recovery',
    category: 'Audit, Security & Procedures',
    summary: 'Three-tier backup strategy: Daily Backup, Weekly Backup, Monthly Archive, and Firebase Cloud Sync.',
    paragraphs: [
      'A financial system requires a reliable backup strategy protected from unauthorized access:',
    ],
    subSections: [
      {
        heading: 'Daily Backup',
        text: 'Backup important transaction data daily (supported via Auto-Backup Snapshots & Firebase Cloud Sync).',
      },
      {
        heading: 'Weekly Backup',
        text: 'Maintain a verified weekly JSON/Cloud backup copy.',
      },
      {
        heading: 'Monthly Backup',
        text: 'Maintain a separate monthly archive after month-end closing.',
      },
    ],
  },
  {
    number: 36,
    id: 'sec-36-error-handling',
    title: '36. Error Handling',
    category: 'Audit, Security & Procedures',
    summary: 'Standard remediation protocols for incorrect amounts, wrong campus, duplicate vouchers, and missing info.',
    paragraphs: [
      'When an error occurs, users should identify the nature of the problem and follow the standard remediation protocol:',
    ],
    subSections: [
      {
        heading: 'Incorrect Amount',
        text: 'Edit the transaction in Edit Transactions if user permissions allow editing, or post an adjusting Journal Voucher (JV).',
      },
      {
        heading: 'Wrong Campus',
        text: 'Correct the campus assignment before final approval.',
      },
      {
        heading: 'Duplicate Voucher',
        text: 'Mark/cancel or delete the duplicate according to organizational policy.',
      },
      {
        heading: 'Missing Information',
        text: 'Return/reject the transaction for completion of narration or supporting reference.',
      },
      {
        heading: 'Technical Error',
        text: 'Record the error message and report it to the Super Administrator.',
      },
    ],
  },
  {
    number: 37,
    id: 'sec-37-daily-procedure',
    title: '37. Recommended Daily Procedure for Finance Staff',
    category: 'Audit, Security & Procedures',
    summary: 'Step-by-step daily operating routine for Beginning of Day, During the Day, and End of Day.',
    subSections: [
      {
        heading: 'At the Beginning of the Day',
        bullets: [
          '1. Login to the Aplus School System.',
          '2. Review pending transactions.',
          "3. Review previous day's entries.",
          '4. Check outstanding vouchers.',
          '5. Confirm petty cash opening balance.',
        ],
      },
      {
        heading: 'During the Day',
        bullets: [
          '1. Record each financial transaction promptly.',
          '2. Create the relevant voucher (BPV, BRV, CPV, CRV, JV, or PCV).',
          '3. Enter accurate, detailed descriptions.',
          '4. Attach supporting bill/cheque/receipt information where applicable.',
          '5. Submit transactions for approval.',
        ],
      },
      {
        heading: 'At the End of the Day',
        bullets: [
          '1. Review all transactions entered today.',
          '2. Check total expenses.',
          '3. Reconcile petty cash (System Balance vs Physical Cash).',
          '4. Review pending vouchers.',
          '5. Generate the daily report.',
          '6. Confirm that records are complete and backed up.',
        ],
      },
    ],
  },
  {
    number: 38,
    id: 'sec-38-monthly-closing-procedure',
    title: '38. Recommended Monthly Closing Procedure',
    category: 'Audit, Security & Procedures',
    summary: '10-step month-end closing and reconciliation protocol for finance controllers.',
    paragraphs: [
      'At month-end, finance staff and administrators execute the following 10-step closing procedure:',
    ],
    bullets: [
      '1. Stop entry for the closing period when appropriate.',
      '2. Review all vouchers for the month.',
      '3. Verify all approved transactions.',
      '4. Check and resolve pending transactions.',
      '5. Reconcile petty cash across all campuses.',
      '6. Review campus-wise expenses.',
      '7. Review category-wise expenses.',
      '8. Check unusual or high-value transactions.',
      '9. Generate official monthly financial reports (PDF).',
      '10. Preserve and archive the monthly financial record.',
    ],
  },
  {
    number: 39,
    id: 'sec-39-management-dashboard-use',
    title: '39. Management Dashboard Use',
    category: 'Workflows & Reporting',
    summary: 'Executive monitoring of total expenses, cash position, pending approvals, and monthly trends.',
    paragraphs: [
      'Management uses the Executive Dashboard for strategic monitoring rather than entering routine transactions, providing a quick overview without examining every individual voucher:',
    ],
    bullets: [
      'Total expenses',
      'Current cash & bank position',
      'Pending approvals requiring action',
      'Campus comparative activity',
      'Major expense categories',
      'Monthly cash flow trends',
      'Outstanding transactions',
    ],
  },
  {
    number: 40,
    id: 'sec-40-benefits',
    title: '40. Benefits of the System',
    category: 'Foundations & Scope',
    summary: 'Operational advantages: improved organization, faster reporting, transparency, multi-campus control, and audit readiness.',
    subSections: [
      { heading: 'Improved Organization', text: 'All financial records are maintained systematically.' },
      { heading: 'Faster Reporting', text: 'Reports are generated instantaneously without manually calculating registers.' },
      { heading: 'Better Transparency', text: 'Every transaction has an identifiable record and audit trail.' },
      { heading: 'Reduced Paperwork', text: 'Digital records reduce dependence on physical registers.' },
      { heading: 'Multi-Campus Control', text: 'Management monitors multiple campuses from a centralized system.' },
      { heading: 'Better Accountability', text: 'Users and transactions are tracked with role attribution.' },
      { heading: 'Easier Auditing', text: 'Sequential voucher numbers and histories simplify verification.' },
      { heading: 'Better Financial Planning', text: 'Historical data supports future campus budgeting.' },
    ],
  },
  {
    number: 41,
    id: 'sec-41-standard-voucher-format',
    title: '41. Suggested Standard Voucher Format',
    category: 'Templates, FAQs & Blueprint',
    summary: 'Formal APLUS SCHOOL SYSTEM Payment / Expense Voucher field specification.',
    paragraphs: [
      'Every official APLUS SCHOOL SYSTEM Payment / Expense Voucher follows this standardized structure:',
    ],
    table: {
      headers: ['Field', 'Required Information'],
      rows: [
        ['Voucher No.', 'Unique sequential ID (e.g. APS-EXP-00001 / CPV-2026-001)'],
        ['Date', 'Transaction date (YYYY-MM-DD)'],
        ['Campus', 'Assigned campus branch (e.g. Main Campus / Khiali Campus)'],
        ['Category', 'Standardized Expense / Account Head (e.g. Stationery)'],
        ['Payee', 'Recipient / Supplier name'],
        ['Description', 'Detailed purpose of expenditure'],
        ['Amount', 'Numeric amount in PKR'],
        ['Payment Method', 'Cash / Bank Transfer / Cheque'],
        ['Prepared By', 'Officer who entered the voucher'],
        ['Checked By', 'Internal verifier'],
        ['Approved By', 'Authorizing administrator / management'],
        ['Status', 'Draft / Submitted / Approved / Paid'],
        ['Remarks', 'Supporting bill / invoice / cheque notes'],
      ],
    },
  },
  {
    number: 42,
    id: 'sec-42-example-transaction',
    title: '42. Example Transaction',
    category: 'Templates, FAQs & Blueprint',
    summary: 'Walkthrough of a PKR 4,500 Stationery purchase from Submitted → Approved → Paid.',
    paragraphs: [
      'Suppose a campus purchases stationery for PKR 4,500. The transaction is entered and progresses through the approval lifecycle as follows:',
    ],
    table: {
      headers: ['Attribute', 'Recorded Value'],
      rows: [
        ['Date', '30 September 2026'],
        ['Campus', 'Main Campus (A+ School System Khiali Campus)'],
        ['Category', 'Stationery (500-3-01)'],
        ['Payee', 'Stationery Supplier'],
        ['Amount', 'PKR 4,500'],
        ['Payment Method', 'Cash (CPV / Petty Cash)'],
        ['Description', 'Stationery purchased for administrative and classroom use'],
        ['Initial Status', 'Submitted'],
        ['After Review & Approval', 'Status → Approved'],
        ['After Payment', 'Status → Paid / Posted'],
      ],
    },
  },
  {
    number: 43,
    id: 'sec-43-financial-control-principles',
    title: '43. Financial Control Principles',
    category: 'Audit, Security & Procedures',
    summary: 'Five core internal controls: Separation of Duties, Supporting Evidence, Authorization, Reconciliation, and Review.',
    subSections: [
      {
        heading: 'Separation of Duties',
        text: 'Where practical, the person entering a transaction should not be the only person responsible for approving it.',
      },
      {
        heading: 'Supporting Evidence',
        text: 'Expenses must have appropriate supporting documentation (bills, invoices, receipts).',
      },
      {
        heading: 'Authorization',
        text: 'Expenses must be approved according to organizational policy limits.',
      },
      {
        heading: 'Reconciliation',
        text: 'Cash and bank financial records must be periodically reconciled.',
      },
      {
        heading: 'Review',
        text: 'Management must periodically review consolidated financial reports.',
      },
    ],
  },
  {
    number: 44,
    id: 'sec-44-system-administration',
    title: '44. System Administration',
    category: 'Audit, Security & Procedures',
    summary: 'Periodic administrative review of active users, permissions, campuses, categories, sequences, and backups.',
    paragraphs: [
      'The system administrator must periodically review all system governance parameters. Inactive users must have access removed or disabled according to organizational policy.',
    ],
    bullets: [
      'Active users & User permissions',
      'Campus records & float limits',
      'Expense categories & Chart of Accounts',
      'Voucher numbering sequences',
      'Financial reports & trial balance equilibrium',
      'Backup status & System activity logs',
    ],
  },
  {
    number: 45,
    id: 'sec-45-future-enhancements',
    title: '45. Future Enhancements',
    category: 'Foundations & Scope',
    summary: 'Expansion roadmap: Student Fee Management, Payroll, Procurement, Inventory, Budgeting, and Mobile Access.',
    subSections: [
      {
        heading: 'Student Fee Management',
        bullets: ['Student fee collection & Fee vouchers', 'Defaulter reports & Fee clearance', 'Campus-wise fee collection'],
      },
      {
        heading: 'Payroll',
        bullets: ['Staff salary management & Salary sheets', 'Deductions & Attendance integration'],
      },
      {
        heading: 'Procurement',
        bullets: ['Purchase requests & Purchase orders', 'Supplier management & Stock receiving'],
      },
      {
        heading: 'Inventory',
        bullets: ['Stationery inventory & School supplies', 'Stock transfers between campuses & Stock alerts'],
      },
      {
        heading: 'Budgeting',
        bullets: ['Campus budgets & Department budgets', 'Monthly budget comparison & Actual vs budget reports'],
      },
      {
        heading: 'Mobile Access',
        bullets: ['Mobile-responsive interface allowing authorized users to review and record transactions remotely'],
      },
    ],
  },
  {
    number: 46,
    id: 'sec-46-recommended-financial-workflow',
    title: '46. Recommended Financial Workflow',
    category: 'Workflows & Reporting',
    summary: 'Complete 16-stage institutional financial lifecycle from Campus/User to Record Archived.',
    paragraphs: [
      'The complete recommended institutional workflow across all Aplus School System campuses:',
    ],
    flowSteps: [
      'Campus / User',
      'Expense Occurs',
      'Expense Details Collected',
      'Transaction Entered',
      'Voucher Generated',
      'Supporting Information Attached',
      'Submitted for Review',
      'Finance Review',
      'Management Approval',
      'Payment',
      'Voucher Marked Paid',
      'Petty Cash / Bank Updated',
      'Daily Report',
      'Monthly Report',
      'Financial Reconciliation',
      'Record Archived',
    ],
  },
  {
    number: 47,
    id: 'sec-47-faqs',
    title: '47. Frequently Asked Questions (FAQs)',
    category: 'Templates, FAQs & Blueprint',
    summary: 'Answers to 7 common operational questions regarding vouchers, campus selection, descriptions, petty cash, and statuses.',
    subSections: [
      {
        heading: 'Q1. Why is a voucher required?',
        text: 'A voucher provides a formal record of a financial transaction and supports accountability.',
      },
      {
        heading: 'Q2. Why should the campus be selected correctly?',
        text: 'Because incorrect campus assignment causes inaccurate campus-wise reporting.',
      },
      {
        heading: 'Q3. Why should descriptions be detailed?',
        text: 'A detailed description allows another person to understand the reason for the expense without asking the original user.',
      },
      {
        heading: 'Q4. What is petty cash?',
        text: 'Petty cash is money maintained for small routine operational expenses.',
      },
      {
        heading: 'Q5. Why should petty cash be reconciled?',
        text: 'To ensure that the physical cash agrees with the system-recorded balance.',
      },
      {
        heading: 'Q6. What should be done if a voucher contains an error?',
        text: "It should be corrected according to the user's permissions and the organization's approval policy.",
      },
      {
        heading: 'Q7. Why are approval statuses important?',
        text: 'They distinguish transactions that are drafts, submitted, approved, paid, rejected, or cancelled.',
      },
    ],
  },
  {
    number: 48,
    id: 'sec-48-conclusion',
    title: '48. Conclusion',
    category: 'Templates, FAQs & Blueprint',
    summary: 'Creating a controlled, organized, transparent, and easily reportable multi-campus financial environment.',
    paragraphs: [
      'The Aplus School System Multi-Campus Voucher & Petty Cash Management System provides a structured framework for managing financial transactions across multiple educational campuses.',
      "The system's central objective is to create a controlled, organized, transparent, and easily reportable financial environment.",
      'By maintaining accurate vouchers, campus-wise transactions, petty cash records, approval workflows and financial reports, the organization improves its day-to-day financial administration and provides management with clearer information for operational planning.',
      'The system is supported by organizational policies covering authorization limits, documentation requirements, approval procedures, reconciliation, backups, and user access.',
    ],
  },
  {
    number: 49,
    id: 'sec-49-document-structure',
    title: '49. Recommended Document Structure for the Final Aplus Manual',
    category: 'Templates, FAQs & Blueprint',
    summary: 'Complete 38-chapter blueprint for the formal 50–80 page Aplus School System Software Manual.',
    paragraphs: [
      'For the formal 50–80 page Aplus School System Software Manual, the complete 38-part master document structure is organized as follows:',
    ],
    bullets: [
      '1. Cover Page',
      '2. Document Control',
      '3. Revision History',
      '4. Table of Contents',
      '5. Introduction',
      '6. System Objectives',
      '7. System Scope',
      '8. System Architecture',
      '9. User Roles',
      '10. Login',
      '11. Dashboard',
      '12. Campus Management',
      '13. Voucher Management',
      '14. Expense Management',
      '15. Petty Cash',
      '16. Payment Management',
      '17. Approval Workflow',
      '18. Reports',
      '19. Search & Filters',
      '20. Financial Reconciliation',
      '21. User Management',
      '22. Permissions',
      '23. Security',
      '24. Backup & Recovery',
      '25. Audit Trail',
      '26. Daily Procedures',
      '27. Monthly Procedures',
      '28. Administrator Manual',
      '29. Finance User Manual',
      '30. Campus User Manual',
      '31. Management Reporting',
      '32. Troubleshooting',
      '33. FAQs',
      '34. Future Enhancements',
      '35. Appendices',
      '36. Sample Voucher',
      '37. Sample Reports',
      '38. Process Flowcharts',
    ],
  },
];

export const DAILY_PROCEDURE_CHECKLIST = {
  beginningOfDay: [
    { id: 'bod-1', label: 'Login to the Aplus School System with assigned credentials' },
    { id: 'bod-2', label: 'Review pending transactions awaiting verification or approval' },
    { id: 'bod-3', label: "Review previous day's ledger and petty cash entries" },
    { id: 'bod-4', label: 'Check outstanding vouchers and unpresented cheques' },
    { id: 'bod-5', label: 'Confirm petty cash opening balance matches physical cash drawer' },
  ],
  duringTheDay: [
    { id: 'dtd-1', label: 'Record each financial transaction immediately as it occurs' },
    { id: 'dtd-2', label: 'Create the relevant voucher (BPV, BRV, CPV, CRV, JV, or Petty Cash)' },
    { id: 'dtd-3', label: 'Enter accurate descriptions (What, Why, and Which Campus/Dept)' },
    { id: 'dtd-4', label: 'Attach/record supporting bill, invoice, or cheque numbers' },
    { id: 'dtd-5', label: 'Submit transactions for finance/management approval' },
  ],
  endOfDay: [
    { id: 'eod-1', label: 'Review all transactions entered during the working day' },
    { id: 'eod-2', label: 'Verify total daily expenses and category allocations' },
    { id: 'eod-3', label: 'Reconcile petty cash (System Balance vs Physical Cash Available)' },
    { id: 'eod-4', label: 'Review remaining pending vouchers' },
    { id: 'eod-5', label: 'Generate and verify the Daily Expense & Cash Book Report' },
    { id: 'eod-6', label: 'Confirm records are complete and synced to Firebase Cloud Backup' },
  ],
};

export const MONTHLY_CLOSING_CHECKLIST = [
  { id: 'mc-1', label: '1. Stop routine entry for the closing period when appropriate' },
  { id: 'mc-2', label: '2. Review all vouchers (BPV, BRV, CPV, CRV, JV) for completeness' },
  { id: 'mc-3', label: '3. Verify all approved transactions and signatures' },
  { id: 'mc-4', label: '4. Check and resolve any pending or draft transactions' },
  { id: 'mc-5', label: '5. Reconcile petty cash across all active school campuses' },
  { id: 'mc-6', label: '6. Review campus-wise expenditure comparisons' },
  { id: 'mc-7', label: '7. Review category-wise expense distributions' },
  { id: 'mc-8', label: '8. Inspect unusual or high-value transactions' },
  { id: 'mc-9', label: '9. Generate official Monthly Financial & 8-Column Trial Balance Reports' },
  { id: 'mc-10', label: '10. Preserve and archive the monthly financial snapshot in Cloud & JSON' },
];

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { RootApp } from './core/aplusEngine';
import { AplusSystemManual } from './components/AplusSystemManual';
import { AplusTopBar } from './components/AplusTopBar';
import { SecureAuditTrail } from './components/SecureAuditTrail';
import { PrintableVoucherA4Layout } from './components/PrintableVoucherA4Layout';
import { PhysicalCashReconciliation } from './components/PhysicalCashReconciliation';
import { BudgetVarianceWidget } from './components/BudgetVarianceWidget';
import { PettyCashCategoryAnalytics } from './components/PettyCashCategoryAnalytics';
import { ModernErpSuite } from './components/ModernErpSuite';
import {
  BulkVoucherAndAccessManager,
  installGlobalVisibilityHook,
} from './components/BulkVoucherAndAccessManager';
import { FinancialHealthAndSuggestions } from './components/FinancialHealthAndSuggestions';
import { MultiFormatReportsHub } from './components/MultiFormatReportsHub';
import { DynamicReportSignatureBlock } from './components/ReportSignatureManager';
import { initFirebaseCloudSync } from './services/firebaseSync';

initFirebaseCloudSync();
installGlobalVisibilityHook();
window.__APLUS_CUSTOM_DOCS__ = AplusSystemManual;
window.__APLUS_AUDIT_TRAIL__ = SecureAuditTrail;
window.__APLUS_VOUCHER_PRINT_LAYOUT__ = PrintableVoucherA4Layout;
window.__APLUS_CASH_RECONCILIATION__ = PhysicalCashReconciliation;
window.__APLUS_BUDGET_VARIANCE_WIDGET__ = BudgetVarianceWidget;
window.__APLUS_PETTY_CASH_CHART__ = PettyCashCategoryAnalytics;
window.__APLUS_MODERN_ERP__ = ModernErpSuite;
window.__APLUS_BULK_VOUCHER_HUB__ = BulkVoucherAndAccessManager;
window.__APLUS_SUGGESTIONS_HUB__ = FinancialHealthAndSuggestions;
window.__APLUS_MULTI_FORMAT_REPORTS__ = MultiFormatReportsHub;
window.__APLUS_REPORT_SIGNATURES_BLOCK__ = DynamicReportSignatureBlock;
window.__APLUS_TOP_BAR__ = AplusTopBar;

export default function App() {
  useEffect(() => {
    initFirebaseCloudSync();
    installGlobalVisibilityHook();
    window.__APLUS_CUSTOM_DOCS__ = AplusSystemManual;
    window.__APLUS_AUDIT_TRAIL__ = SecureAuditTrail;
    window.__APLUS_VOUCHER_PRINT_LAYOUT__ = PrintableVoucherA4Layout;
    window.__APLUS_CASH_RECONCILIATION__ = PhysicalCashReconciliation;
    window.__APLUS_BUDGET_VARIANCE_WIDGET__ = BudgetVarianceWidget;
    window.__APLUS_PETTY_CASH_CHART__ = PettyCashCategoryAnalytics;
    window.__APLUS_MODERN_ERP__ = ModernErpSuite;
    window.__APLUS_BULK_VOUCHER_HUB__ = BulkVoucherAndAccessManager;
    window.__APLUS_SUGGESTIONS_HUB__ = FinancialHealthAndSuggestions;
    window.__APLUS_MULTI_FORMAT_REPORTS__ = MultiFormatReportsHub;
    window.__APLUS_REPORT_SIGNATURES_BLOCK__ = DynamicReportSignatureBlock;
    window.__APLUS_TOP_BAR__ = AplusTopBar;
  }, []);

  return <RootApp />;
}

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  ArrowUpRight,
  Building2,
  Scale,
  FilePlus2,
  Wallet,
  LayoutGrid,
  Plus,
  ChevronDown,
  ChevronUp,
  Rocket,
  Globe,
  Server,
  CloudUpload,
  ShieldCheck,
  Terminal,
  Type,
} from 'lucide-react';
import { useAccounting } from '../core/aplusEngine';
import { pushMasterCloudSnapshot } from '../services/firebaseSync';

function formatPKR(val: number): string {
  return `Rs. ${Math.round(val || 0).toLocaleString('en-PK')}`;
}

export const FinancialHealthAndSuggestions: React.FC<{
  onNavigate?: (tab: string) => void;
}> = ({ onNavigate }) => {
  const {
    campuses,
    currentCampusId,
    setCurrentCampusId,
    transactions,
    pettyCashTransactions,
    accountHeads,
    orgSettings,
    updateOrgSettings,
    addCampus,
    updateCampus,
    addAccountHead,
    updateCampusOpeningDrCr,
    exportSystemState,
  } = useAccounting();

  const [isExpanded, setIsExpanded] = useState(true);
  const [activeQuickForm, setActiveQuickForm] = useState<
    | 'none'
    | 'new_campus'
    | 'new_account'
    | 'opening_balance'
    | 'hosting_guide'
    | 'header_footer_text'
  >('none');
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Header & Footer Text Editor State
  const [hdrSchoolName, setHdrSchoolName] = useState(orgSettings?.schoolName || '');
  const [hdrSubTitle, setHdrSubTitle] = useState(orgSettings?.subTitle || '');
  const [hdrLeftText, setHdrLeftText] = useState(
    orgSettings?.headerLeftText || orgSettings?.schoolName || ''
  );
  const [hdrRightText, setHdrRightText] = useState(
    orgSettings?.headerRightText ?? orgSettings?.tagline ?? ''
  );
  const [loginDesc, setLoginDesc] = useState(orgSettings?.loginDescription || '');
  const [loginFooterL, setLoginFooterL] = useState(orgSettings?.loginFooterLeft || '');
  const [loginFooterR, setLoginFooterR] = useState(orgSettings?.loginFooterRight || '');
  const [ftrLeftText, setFtrLeftText] = useState(
    orgSettings?.footerLeftText ??
      `${orgSettings?.schoolName || 'Aplus School System'} • Multi-Campus Voucher & Petty Cash Management System`
  );
  const [ftrRightText, setFtrRightText] = useState(
    orgSettings?.footerRightText ??
      (orgSettings?.tagline ||
        'Compliant with Four Voucher Standard (BPV, BRV, CPV, CRV) & Imprest Petty Cash System')
  );

  // Quick Form 1: Create Campus Branch
  const [campusName, setCampusName] = useState('');
  const [campusCode, setCampusCode] = useState('');
  const [campusCity, setCampusCity] = useState('Gujranwala');
  const [accountantName, setAccountantName] = useState('');
  const [pettyCashFloat, setPettyCashFloat] = useState('0');

  // Quick Form 2: Create Account Head
  const [accCode, setAccCode] = useState('');
  const [accName, setAccName] = useState('');
  const [accCategory, setAccCategory] = useState<
    'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
  >('Expense');

  // Quick Form 3: Set Initial Opening Balances
  const [openCash, setOpenCash] = useState('0');
  const [openBank, setOpenBank] = useState('0');
  const [openPetty, setOpenPetty] = useState('0');

  const showNotice = (msg: string) => {
    setBannerMessage(msg);
    setTimeout(() => setBannerMessage(null), 5000);
  };

  const handleSyncProductionCloudBackup = async () => {
    setIsSyncingCloud(true);
    try {
      const state = exportSystemState('all');
      await pushMasterCloudSnapshot(state);
      showNotice(
        'Production ledger, campuses, COA, and ERP state backed up to Firebase Firestore Cloud!'
      );
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleCreateCampusFromScratch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campusName.trim() || !campusCode.trim()) return;
    const floatVal = Math.max(0, Number(pettyCashFloat) || 0);
    addCampus({
      code: campusCode.trim().toUpperCase(),
      name: campusName.trim(),
      city: campusCity.trim() || 'Gujranwala',
      address: `${campusCity.trim()} Campus Branch`,
      phone: '',
      email: '',
      accountantName: accountantName.trim() || 'Campus Accountant',
      pettyCashFloat: floatVal,
      currentPettyCash: floatVal,
      loginEnabled: true,
      status: 'active',
    });
    setCampusName('');
    setCampusCode('');
    setAccountantName('');
    setPettyCashFloat('0');
    setActiveQuickForm('none');
    showNotice(`Created new campus branch "${campusName.trim()}" (${campusCode.trim().toUpperCase()})!`);
  };

  const handleCreateAccountFromScratch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accCode.trim() || !accName.trim()) return;
    addAccountHead({
      code: accCode.trim(),
      accountId: accCode.trim(),
      ledgerCode: accCode.trim(),
      name: accName.trim(),
      category: accCategory,
      type: accCategory === 'Revenue' ? 'Income' : accCategory,
      balance: 0,
      description: `Official ${accCategory} head registered in Chart of Accounts`,
    });
    setAccCode('');
    setAccName('');
    setActiveQuickForm('none');
    showNotice(`Created Account Head "${accCode.trim()} — ${accName.trim()}"!`);
  };

  const handleApplyOpeningBalances = (e: React.FormEvent) => {
    e.preventDefault();
    const targetCampus =
      currentCampusId === 'all' ? campuses[0]?.id || 'campus-main' : currentCampusId;
    const cashVal = Math.max(0, Number(openCash) || 0);
    const bankVal = Math.max(0, Number(openBank) || 0);
    const pettyVal = Math.max(0, Number(openPetty) || 0);
    const totalAssets = cashVal + bankVal + pettyVal;

    const cashHead = accountHeads.find((a) => a.accountId === '1018' || a.code === '100-4-01');
    const pettyHead = accountHeads.find((a) => a.accountId === '1019' || a.code === '100-4-02');
    const bankHead = accountHeads.find((a) => a.accountId === '1020' || a.code === '100-4-03');
    const equityHead = accountHeads.find(
      (a) => a.category === 'Equity' || a.code === '300-1-01' || a.accountId === '3001'
    );

    if (cashHead) updateCampusOpeningDrCr(cashHead.id, targetCampus, cashVal, 0);
    if (pettyHead) updateCampusOpeningDrCr(pettyHead.id, targetCampus, pettyVal, 0);
    if (bankHead) updateCampusOpeningDrCr(bankHead.id, targetCampus, bankVal, 0);
    if (equityHead) updateCampusOpeningDrCr(equityHead.id, targetCampus, 0, totalAssets);

    updateCampus(targetCampus, {
      pettyCashFloat: pettyVal,
      currentPettyCash: pettyVal,
    });

    setActiveQuickForm('none');
    showNotice(
      `Committed balanced Opening Balances for ${
        campuses.find((c) => c.id === targetCampus)?.name || 'Campus'
      }: Cash ${formatPKR(cashVal)}, Bank ${formatPKR(bankVal)}, Petty Cash ${formatPKR(pettyVal)}!`
    );
  };

  const handleSaveHeaderFooterText = async (e: React.FormEvent) => {
    e.preventDefault();
    updateOrgSettings({
      schoolName: hdrSchoolName.trim() || orgSettings.schoolName,
      subTitle: hdrSubTitle.trim(),
      tagline: hdrRightText.trim(),
      headerLeftText: hdrLeftText.trim(),
      headerRightText: hdrRightText.trim(),
      headerTopBarText: hdrRightText.trim(),
      loginDescription: loginDesc.trim(),
      loginFooterLeft: loginFooterL.trim(),
      loginFooterRight: loginFooterR.trim(),
      footerLeftText: ftrLeftText.trim(),
      footerRightText: ftrRightText.trim(),
    });
    setActiveQuickForm('none');
    showNotice(
      'Header & Footer text saved and synced across Login Screen, Dashboard Header, and Page Footer!'
    );
  };

  const totalLedgerBalance = useMemo(
    () =>
      (accountHeads || []).reduce(
        (sum, a) => sum + Math.abs(Number(a.balance) || 0),
        0
      ),
    [accountHeads]
  );

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-6 print:hidden">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Top Production Enterprise Header (Reset Button Removed, Replaced with Hosting & Cloud Launch Controls) */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                <span>Enterprise Production & Cloud Hosting Command Center</span>
                <span aria-hidden="true">·</span>
                <span>
                  {campuses.length} Campus(es) · {(transactions || []).length} Vouchers ·{' '}
                  {(pettyCashTransactions || []).length} Petty Cash Slips
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Production-Ready Financial ERP — Campuses, COA, Vouchers, 360° ERP & Hosting Guide
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsExpanded(true);
                setHdrSchoolName(orgSettings?.schoolName || '');
                setHdrSubTitle(orgSettings?.subTitle || '');
                setHdrLeftText(orgSettings?.headerLeftText || orgSettings?.schoolName || '');
                setHdrRightText(orgSettings?.headerRightText ?? orgSettings?.tagline ?? '');
                setLoginDesc(orgSettings?.loginDescription || '');
                setLoginFooterL(orgSettings?.loginFooterLeft || '');
                setLoginFooterR(orgSettings?.loginFooterRight || '');
                setFtrLeftText(
                  orgSettings?.footerLeftText ??
                    `${orgSettings?.schoolName || 'Aplus School System'} • Multi-Campus Voucher & Petty Cash Management System`
                );
                setFtrRightText(
                  orgSettings?.footerRightText ??
                    (orgSettings?.tagline ||
                      'Compliant with Four Voucher Standard (BPV, BRV, CPV, CRV) & Imprest Petty Cash System')
                );
                setActiveQuickForm(
                  activeQuickForm === 'header_footer_text' ? 'none' : 'header_footer_text'
                );
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Customize Header Text, School Title, Login Screen Text, and Footer Text across the entire site"
            >
              <Type className="w-3.5 h-3.5" />
              <span>
                {activeQuickForm === 'header_footer_text'
                  ? 'Close Header & Footer Editor'
                  : 'Manage Header & Footer Text'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsExpanded(true);
                setActiveQuickForm(
                  activeQuickForm === 'hosting_guide' ? 'none' : 'hosting_guide'
                );
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="View step-by-step guide to host, deploy, and upload this project to Cloud Run, Firebase Hosting, Vercel, or Netlify"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>
                {activeQuickForm === 'hosting_guide'
                  ? 'Hide Hosting & Upload Guide'
                  : 'Hosting & Project Upload Guide'}
              </span>
            </button>

            <button
              type="button"
              disabled={isSyncingCloud}
              onClick={handleSyncProductionCloudBackup}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Backup current production ledger & settings to Firebase Cloud"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>{isSyncingCloud ? 'Syncing Cloud...' : 'Save Cloud Snapshot'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <span>{isExpanded ? 'Collapse Hub' : 'Expand Hub'}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Status Banner */}
        {bannerMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-3 flex items-center justify-between text-xs font-bold text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{bannerMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerMessage(null)}
              className="underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {isExpanded && (
          <div className="p-5 space-y-5 bg-slate-50/50">
            {/* HEADER & FOOTER TEXT CUSTOMIZATION MANAGER */}
            {activeQuickForm === 'header_footer_text' && (
              <form
                onSubmit={handleSaveHeaderFooterText}
                className="bg-white p-5 rounded-xl border-2 border-amber-300 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                      <Type className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                        Manage Site Header & Footer Text (Login Page, Top Bar & Main Footer)
                      </h3>
                      <p className="text-xs text-slate-600">
                        Customize the Header Title, Subtitle, Login Page Text, and Footer Text displayed across all browsers. Leave any optional field blank to hide it.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveQuickForm('none')}
                    className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Main Organization / School Title
                    </label>
                    <input
                      type="text"
                      value={hdrSchoolName}
                      onChange={(e) => setHdrSchoolName(e.target.value)}
                      placeholder="e.g. Aplus School System"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Header Subtitle / Network Tagline
                    </label>
                    <input
                      type="text"
                      value={hdrSubTitle}
                      onChange={(e) => setHdrSubTitle(e.target.value)}
                      placeholder="e.g. Higher Secondary & College Network"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Top Header Left Text
                    </label>
                    <input
                      type="text"
                      value={hdrLeftText}
                      onChange={(e) => setHdrLeftText(e.target.value)}
                      placeholder="Top-left header brand text"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Top Header Right Badge / Banner Text
                    </label>
                    <input
                      type="text"
                      value={hdrRightText}
                      onChange={(e) => setHdrRightText(e.target.value)}
                      placeholder="Leave blank to hide badge"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Footer Left Text (Login & Main App Footer)
                    </label>
                    <input
                      type="text"
                      value={ftrLeftText}
                      onChange={(e) => setFtrLeftText(e.target.value)}
                      placeholder="e.g. © 2026 Aplus School System • Multi-Campus Financial Management"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold text-slate-900"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Footer Right Text (Login & Main App Footer)
                    </label>
                    <input
                      type="text"
                      value={ftrRightText}
                      onChange={(e) => setFtrRightText(e.target.value)}
                      placeholder="e.g. All Rights Reserved • Enterprise Accounting Portal"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold text-slate-900"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Login Left Panel Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={loginDesc}
                      onChange={(e) => setLoginDesc(e.target.value)}
                      placeholder="Optional welcome message on Login screen left panel..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Login Left Panel Bottom-Left (Optional)
                    </label>
                    <input
                      type="text"
                      value={loginFooterL}
                      onChange={(e) => setLoginFooterL(e.target.value)}
                      placeholder="Leave blank to hide"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Login Left Panel Bottom-Right (Optional)
                    </label>
                    <input
                      type="text"
                      value={loginFooterR}
                      onChange={(e) => setLoginFooterR(e.target.value)}
                      placeholder="Leave blank to hide"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveQuickForm('none')}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer shadow-xs"
                  >
                    Save & Apply Header / Footer Text
                  </button>
                </div>
              </form>
            )}

            {/* INTERACTIVE STEP-BY-STEP PROJECT UPLOAD & HOSTING GUIDE */}
            {activeQuickForm === 'hosting_guide' && (
              <div className="bg-white p-5 rounded-xl border-2 border-emerald-300 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                        Step-by-Step Guide: How to Upload, Host & Launch This Project
                      </h3>
                      <p className="text-xs text-slate-600">
                        Your application is pre-compiled, connected to Firebase Firestore Cloud (`ai-studio-b937d821-f2ae-4264-a644-bde55ae65179`), and 100% production launch-ready.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveQuickForm('none')}
                    className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                  >
                    Close Guide
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Option A: Direct 1-Click Cloud Run / AI Studio Share & Deploy */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-2">
                    <div className="flex items-center gap-2 font-black text-emerald-800 uppercase">
                      <Rocket className="w-4 h-4 text-emerald-600" />
                      <span>Option 1: 1-Click Cloud Run Deploy (Fastest)</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-700 leading-relaxed">
                      <li>
                        Click the <strong>Share / Deploy (Rocket)</strong> icon in the top-right corner of Google AI Studio.
                      </li>
                      <li>
                        Select <strong>Deploy to Cloud Run</strong> or copy your live <strong>Shared App URL</strong>.
                      </li>
                      <li>
                        Your Firebase Firestore database is already provisioned and bound automatically.
                      </li>
                    </ol>
                  </div>

                  {/* Option B: Upload to GitHub & Host on Vercel / Netlify */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-2">
                    <div className="flex items-center gap-2 font-black text-indigo-800 uppercase">
                      <Server className="w-4 h-4 text-indigo-600" />
                      <span>Option 2: GitHub + Vercel / Netlify</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-700 leading-relaxed">
                      <li>
                        Click <strong>Download ZIP / Export to GitHub</strong> from the AI Studio menu.
                      </li>
                      <li>
                        Sign in to <strong>Vercel.com</strong> or <strong>Netlify.com</strong> and click <strong>Add New Project → Import Git Repository</strong> (or drag-and-drop the folder).
                      </li>
                      <li>
                        Build Command: <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border">npm run build</code> · Output Directory: <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border">dist</code>.
                      </li>
                    </ol>
                  </div>

                  {/* Option C: Firebase Hosting CLI */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-2">
                    <div className="flex items-center gap-2 font-black text-amber-800 uppercase">
                      <Terminal className="w-4 h-4 text-amber-600" />
                      <span>Option 3: Firebase Hosting / Custom Domain</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-700 leading-relaxed">
                      <li>
                        Download the project ZIP and extract it on your computer.
                      </li>
                      <li>
                        Run <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border">npm install && npm run build</code>.
                      </li>
                      <li>
                        Run <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border">npx firebase-tools deploy --only hosting</code> to publish to your custom school domain.
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {/* Inline Quick Creation Forms */}
            {activeQuickForm === 'new_campus' && (
              <form
                onSubmit={handleCreateCampusFromScratch}
                className="bg-white p-4 rounded-xl border-2 border-blue-200 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-blue-900">
                    Create New Campus Branch
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveQuickForm('none')}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <input
                    type="text"
                    required
                    value={campusName}
                    onChange={(e) => setCampusName(e.target.value)}
                    placeholder="Campus Name (e.g. Main Campus)"
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                  />
                  <input
                    type="text"
                    required
                    value={campusCode}
                    onChange={(e) => setCampusCode(e.target.value)}
                    placeholder="Branch Code (e.g. MAIN)"
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold"
                  />
                  <input
                    type="text"
                    value={campusCity}
                    onChange={(e) => setCampusCity(e.target.value)}
                    placeholder="City (e.g. Gujranwala)"
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                  <input
                    type="text"
                    value={accountantName}
                    onChange={(e) => setAccountantName(e.target.value)}
                    placeholder="Accountant / Head Name"
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={pettyCashFloat}
                      onChange={(e) => setPettyCashFloat(e.target.value)}
                      placeholder="Initial Float (PKR)"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs whitespace-nowrap cursor-pointer"
                    >
                      Save Campus
                    </button>
                  </div>
                </div>
              </form>
            )}

            {activeQuickForm === 'new_account' && (
              <form
                onSubmit={handleCreateAccountFromScratch}
                className="bg-white p-4 rounded-xl border-2 border-indigo-200 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-indigo-900">
                    Register New Chart of Accounts Head
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveQuickForm('none')}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    value={accCode}
                    onChange={(e) => setAccCode(e.target.value)}
                    placeholder="Account Code (e.g. 5066 or 500-9-04)"
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold"
                  />
                  <input
                    type="text"
                    required
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    placeholder="Account Title (e.g. Solar Maintenance Expense)"
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                  />
                  <select
                    value={accCategory}
                    onChange={(e) => setAccCategory(e.target.value as any)}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold"
                  >
                    <option value="Asset">100 — Asset</option>
                    <option value="Liability">200 — Liability</option>
                    <option value="Equity">300 — Equity / Capital</option>
                    <option value="Revenue">400 — Revenue / Income</option>
                    <option value="Expense">500 — Operating Expense</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                  >
                    Create Account Head
                  </button>
                </div>
              </form>
            )}

            {activeQuickForm === 'opening_balance' && (
              <form
                onSubmit={handleApplyOpeningBalances}
                className="bg-white p-4 rounded-xl border-2 border-emerald-200 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900">
                    Set Campus Opening Balances (Auto-Balanced with Equity)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveQuickForm('none')}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Target Campus
                    </label>
                    <select
                      value={currentCampusId === 'all' ? campuses[0]?.id : currentCampusId}
                      onChange={(e) => setCurrentCampusId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold"
                    >
                      {campuses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      1018 Cash in Hand (PKR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={openCash}
                      onChange={(e) => setOpenCash(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      1020 Main Bank Account (PKR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={openBank}
                      onChange={(e) => setOpenBank(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      1019 Petty Cash Float (PKR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={openPetty}
                      onChange={(e) => setOpenPetty(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-bold"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                  >
                    Commit Opening Balances
                  </button>
                </div>
              </form>
            )}

            {/* 6 Enterprise Operational Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Step 1: Campuses */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-blue-700 uppercase">
                    <span>Module 1 · Campus Branches</span>
                    <span className="font-mono">{campuses.length} Active</span>
                  </div>
                  <h3 className="mt-1 text-sm font-black text-slate-900">
                    Manage Campus Branches & Credentials
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Register campus branches, assign branch codes, configure accountants, and set petty cash floats.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveQuickForm(
                        activeQuickForm === 'new_campus' ? 'none' : 'new_campus'
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Quick Add Campus</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('campuses')}
                    className="text-[11px] font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Manage Branches</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Step 2: Chart of Accounts */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-700 uppercase">
                    <span>Module 2 · Chart of Accounts</span>
                    <span className="font-mono">{(accountHeads || []).length} Heads</span>
                  </div>
                  <h3 className="mt-1 text-sm font-black text-slate-900">
                    Institutional Chart of Accounts (100–500)
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Full 5-pillar double-entry Chart of Accounts (100 Assets to 500 Operating Expenses). Add custom account heads anytime.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveQuickForm(
                        activeQuickForm === 'new_account' ? 'none' : 'new_account'
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ New Account Head</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('accounts')}
                    className="text-[11px] font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Open Full COA</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Step 3: Opening Balances */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 uppercase">
                    <span>Module 3 · Opening Balances</span>
                    <span className="font-mono">{formatPKR(totalLedgerBalance)}</span>
                  </div>
                  <h3 className="mt-1 text-sm font-black text-slate-900">
                    Campus Opening Cash, Bank & Float
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Configure opening Cash in Hand (1018), Bank (1020), and Petty Cash Float (1019) per campus branch.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveQuickForm(
                        activeQuickForm === 'opening_balance' ? 'none' : 'opening_balance'
                      )
                    }
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Set Cash/Bank Opening</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('openingbalance')}
                    className="text-[11px] font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Full Opening Sheet</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Step 4: Vouchers Entry */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 uppercase">
                    <span>Module 4 · Four-Voucher Standard</span>
                    <span className="font-mono">{(transactions || []).length} Recorded</span>
                  </div>
                  <h3 className="mt-1 text-sm font-black text-slate-900">
                    BPV, BRV, CPV, CRV & JV Vouchers
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Record double-entry vouchers, expand line items inline, print A4 vouchers, and approve pending vouchers in bulk.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate?.('transaction')}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FilePlus2 className="w-3.5 h-3.5" />
                    <span>+ Create Voucher</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('alltransactions')}
                    className="text-[11px] font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Ledger & Bulk Approve</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Step 5: Petty Cash & Physical Cash Count */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 uppercase">
                    <span>Module 5 · Petty Cash & Vault</span>
                    <span className="font-mono">
                      {(pettyCashTransactions || []).length} Slips
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-black text-slate-900">
                    Petty Cash & 7-Day Physical Safe Count
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Record daily campus petty cash expense slips and certify physical PKR currency notes against ledger balances.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate?.('pettycash')}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Open Petty Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('cashreconciliation')}
                    className="text-[11px] font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>Physical Cash Count</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Step 6: 360° ERP & 10-Format Reports */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-purple-700 uppercase">
                    <span>Module 6 · 360° ERP & 10 Report Formats</span>
                    <span className="font-mono">Live Sync</span>
                  </div>
                  <h3 className="mt-1 text-sm font-black text-slate-900">
                    Fee Challans, Payroll, POs & 10 Report Formats
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Issue Fee Challans, process Staff Payroll, manage Store Inventory, and export all 10 official financial report formats.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate?.('erp_overview')}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Launch 360° ERP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('reports')}
                    className="text-[11px] font-bold text-slate-700 hover:text-slate-900 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>10 Report Formats</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Database,
  Download,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building2,
  Layers,
  ArrowRight,
  FileText,
  FileCheck,
} from 'lucide-react';
import {
  exportLocalDataBackup,
  performMigrationDryRun,
  extractLocalBusinessRecords,
  MigrationDryRunReport,
} from '../services/migrationBackupService';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { getStoredSchoolClients } from '../services/platformSiteAdminService';
import { useAccounting } from '../core/aplusEngine';

interface DataMigrationControlCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataMigrationControlCenter: React.FC<DataMigrationControlCenterProps> = ({
  isOpen,
  onClose,
}) => {
  const { campuses } = useAccounting();
  const clients = getStoredSchoolClients();

  const [targetClientId, setTargetClientId] = useState('client-aplus');
  const [defaultCampusId, setDefaultCampusId] = useState(campuses[0]?.id || 'campus-khiali');

  const [dryRunReport, setDryRunReport] = useState<MigrationDryRunReport | null>(null);
  const [hasBackedUp, setHasBackedUp] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<string | null>(null);
  const [migratedCounts, setMigratedCounts] = useState<{
    vouchers: number;
    pettyCash: number;
    campuses: number;
    accounts: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      runDryRun();
    }
  }, [isOpen, targetClientId]);

  const runDryRun = () => {
    const report = performMigrationDryRun(targetClientId);
    setDryRunReport(report);
  };

  const handleDownloadBackup = () => {
    exportLocalDataBackup();
    setHasBackedUp(true);
  };

  const handleExecuteMigration = async () => {
    if (!hasBackedUp) {
      if (!confirm('You have not yet downloaded a local safety backup. It is strongly recommended to export first. Do you want to proceed?')) {
        return;
      }
    }

    setIsMigrating(true);
    setMigrationResult(null);

    try {
      const records = extractLocalBusinessRecords();
      const batchId = `migration_${Date.now()}`;
      const now = new Date().toISOString();

      // Ensure root organization exists
      await setDoc(
        doc(db, 'organizations', targetClientId),
        {
          id: targetClientId,
          status: 'active',
          migrationStatus: 'ready',
          lastMigrationAt: now,
          migrationBatchId: batchId,
        },
        { merge: true }
      );

      let vCount = 0;
      let pCount = 0;
      let cCount = 0;
      let aCount = 0;

      // 1. Migrate Campuses in batches
      const campusBatch = writeBatch(db);
      for (const c of records.campuses) {
        if (!c.id) continue;
        const cId = String(c.id);
        campusBatch.set(
          doc(db, `organizations/${targetClientId}/campuses`, cId),
          {
            ...c,
            clientId: targetClientId,
            revision: 1,
            migratedAt: now,
            migrationBatchId: batchId,
          },
          { merge: true }
        );
        cCount++;
      }
      if (cCount > 0) await campusBatch.commit();

      // 2. Migrate Vouchers in batches of 200
      const voucherChunks = [];
      for (let i = 0; i < records.vouchers.length; i += 200) {
        voucherChunks.push(records.vouchers.slice(i, i + 200));
      }

      for (const chunk of voucherChunks) {
        const vBatch = writeBatch(db);
        for (const v of chunk) {
          if (!v.id) continue;
          const vId = String(v.id);
          const vCampusId = v.campusId || defaultCampusId;
          vBatch.set(
            doc(db, `organizations/${targetClientId}/vouchers`, vId),
            {
              ...v,
              clientId: targetClientId,
              campusId: vCampusId,
              revision: 1,
              migratedAt: now,
              migrationBatchId: batchId,
            },
            { merge: true }
          );
          vCount++;
        }
        await vBatch.commit();
      }

      // 3. Migrate Petty Cash in batches
      const pettyBatch = writeBatch(db);
      for (const p of records.pettyCash) {
        if (!p.id) continue;
        const pId = String(p.id);
        const pCampusId = p.campusId || defaultCampusId;
        pettyBatch.set(
          doc(db, `organizations/${targetClientId}/petty_cash`, pId),
          {
            ...p,
            clientId: targetClientId,
            campusId: pCampusId,
            revision: 1,
            migratedAt: now,
            migrationBatchId: batchId,
          },
          { merge: true }
        );
        pCount++;
      }
      if (pCount > 0) await pettyBatch.commit();

      // 4. Migrate COA in batches
      const coaBatch = writeBatch(db);
      for (const a of records.accountHeads) {
        if (!a.id && !a.code) continue;
        const aId = String(a.id || a.code);
        coaBatch.set(
          doc(db, `organizations/${targetClientId}/account_heads`, aId),
          {
            ...a,
            clientId: targetClientId,
            revision: 1,
            migratedAt: now,
            migrationBatchId: batchId,
          },
          { merge: true }
        );
        aCount++;
      }
      if (aCount > 0) await coaBatch.commit();

      // 5. Write migration audit trail record
      await setDoc(doc(db, `organizations/${targetClientId}/audit`, batchId), {
        id: batchId,
        action: 'MIGRATION_EXECUTE',
        actor: 'Administrator',
        timestamp: now,
        details: `Migrated ${vCount} vouchers, ${pCount} petty cash, ${cCount} campuses, ${aCount} COA heads into tenant ${targetClientId}`,
      });

      setMigratedCounts({ vouchers: vCount, pettyCash: pCount, campuses: cCount, accounts: aCount });
      setMigrationResult(`Migration completed successfully! Central persistent cloud datastores updated.`);
      runDryRun();
    } catch (err: any) {
      console.error('Migration failure:', err);
      setMigrationResult(`Migration failed: ${err.message || 'Check Firestore security rules'}`);
    } finally {
      setIsMigrating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-900/60 border border-indigo-700 text-indigo-300 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Multi-Client Persistent Cloud Migration Center</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-900 text-indigo-200 uppercase">
                  Authoritative Store
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Non-destructively inspect, validate, and commit local ledger records to tenant-isolated cloud paths.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Step 1: Backup Protection */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-900/80 text-emerald-300 flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <h3 className="text-sm font-bold text-white">Protect Existing Records (Non-Destructive)</h3>
              </div>
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Local Safety Backup (JSON)</span>
              </button>
            </div>
            <p className="text-slate-400 text-[11px]">
              Downloads a full offline snapshot of all vouchers, petty cash slips, campuses, and account heads. No records are deleted or overwritten.
            </p>
            {hasBackedUp && (
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Safety backup generated and downloaded. Local records preserved.</span>
              </div>
            )}
          </div>

          {/* Step 2: Dry Run Validation Report */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-900/80 text-indigo-300 flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <h3 className="text-sm font-bold text-white">Migration Dry Run Validation</h3>
              </div>
              <button
                type="button"
                onClick={runDryRun}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Re-scan Records</span>
              </button>
            </div>

            {dryRunReport && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Vouchers</span>
                  <span className="text-base font-black text-white">{dryRunReport.totalVouchers}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Petty Cash</span>
                  <span className="text-base font-black text-white">{dryRunReport.totalPettyCash}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Campuses</span>
                  <span className="text-base font-black text-white">{dryRunReport.totalCampuses}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Chart of Accounts</span>
                  <span className="text-base font-black text-white">{dryRunReport.totalAccountHeads}</span>
                </div>
              </div>
            )}

            {dryRunReport?.warnings && dryRunReport.warnings.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {dryRunReport.warnings.map((w, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-amber-950/60 border border-amber-800/80 text-amber-200 text-[11px] flex items-center gap-2"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: Explicit Tenant and Campus Target Assignment */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-900/80 text-purple-300 flex items-center justify-center font-bold text-xs">
                3
              </span>
              <h3 className="text-sm font-bold text-white">Target Tenant & Hierarchy Scope</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Target Organization Client</label>
                <select
                  value={targetClientId}
                  onChange={(e) => setTargetClientId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.id})
                    </option>
                  ))}
                  <option value="client-aplus">Aplus School System (client-aplus)</option>
                  <option value="client-apex">Apex Academy (client-apex)</option>
                </select>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Destination path: <code className="text-indigo-300">organizations/{targetClientId}/*</code>
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Default Fallback Campus</label>
                <select
                  value={defaultCampusId}
                  onChange={(e) => setDefaultCampusId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                >
                  {campuses.map((camp) => (
                    <option key={camp.id} value={camp.id}>
                      {camp.name} ({camp.code})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Applied to legacy records without campus assignments.
                </span>
              </div>
            </div>
          </div>

          {/* Migration Result Banner */}
          {migrationResult && (
            <div className="p-3.5 rounded-xl bg-indigo-950/80 border border-indigo-700/80 text-white space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{migrationResult}</span>
              </div>
              {migratedCounts && (
                <p className="text-[11px] text-indigo-200">
                  Committed: {migratedCounts.vouchers} vouchers, {migratedCounts.pettyCash} petty cash slips, {migratedCounts.campuses} campuses, {migratedCounts.accounts} account heads.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Idempotent migration: running multiple times updates without duplicating IDs.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleExecuteMigration}
              disabled={isMigrating}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isMigrating ? 'Committing Batches...' : 'Execute Idempotent Cloud Migration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

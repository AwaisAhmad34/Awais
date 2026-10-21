import { useEffect, useRef, useState } from 'react';
import { tenantApi } from '../../services/tenantApiClient';
import { VoucherWorkspace } from './VoucherWorkspace';

type Row = Record<string, any>;
const reports = ['ledger','trial-balance','income-expense','cash-book'];
export function DataTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <p className="p-5 text-slate-400">No records found.</p>;
  const keys = [...new Set(rows.flatMap(row=>Object.keys(row)))].filter(k=>!['entries','original','details','password','setupLink','campusIds','allowedCampusIds'].includes(k));
  return <div className="overflow-auto"><table className="w-full text-xs text-left"><thead><tr>{keys.map(k=><th key={k} className="p-3 bg-slate-800 whitespace-nowrap">{k.replace(/([A-Z])/g,' $1')}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={row.id||i} className="border-t border-slate-800">{keys.map(k=><td key={k} className="p-3 max-w-xs break-words">{typeof row[k]==='object'?JSON.stringify(row[k]):String(row[k]??'—')}</td>)}</tr>)}</tbody></table></div>;
}
export function DownloadCsv({rows,name}:{rows:Row[];name:string}){
  function download(){
    const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))].filter(k=>!['entries','original','details'].includes(k));
    const cell=(x:any)=>{let s=typeof x==='object'?JSON.stringify(x):String(x??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
    const blob=new Blob(['\ufeff'+[keys.map(cell).join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');a.href=url;a.download=`${name}.csv`;a.click();URL.revokeObjectURL(url);
  }
  return <button onClick={download} disabled={!rows.length}>Download CSV</button>;
}
function SimpleForm({fields,onSubmit,label}:{fields:{name:string;label:string;type?:string;options?:{value:string;label:string}[];value?:string}[];onSubmit:(data:Row)=>Promise<boolean>;label:string}){
  const [busy,setBusy]=useState(false);
  return <form className="grid gap-3 sm:grid-cols-2 p-4 border border-slate-700 rounded-lg" onSubmit={async event=>{event.preventDefault();const form=event.currentTarget;setBusy(true);try{if(await onSubmit(Object.fromEntries(new FormData(form))))form.reset();}finally{setBusy(false);}}}>
    {fields.map(f=><label className="flex flex-col gap-1 text-sm" key={f.name}>{f.label}{f.options?<select name={f.name} required defaultValue={f.value||''}><option value="" disabled>Select…</option>{f.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input name={f.name} type={f.type||'text'} required defaultValue={f.value} step={f.type==='number'?'0.01':undefined} min={f.type==='number'?0:undefined}/>}</label>)}
    <button type="submit" disabled={busy} className="self-end">{busy?'Saving…':label}</button>
  </form>;
}
export function TenantWorkspace({profile,onLogout,onLegacy}:{profile:Row;onLogout:()=>void;onLegacy?:()=>void}) {
  const owner=profile.permissionLevel==='level_1_platform_super_admin';
  const manager=owner||profile.permissionLevel==='level_2_client_super_admin';
  const [clients,setClients]=useState<Row[]>([]),[clientId,setClientId]=useState(profile.clientId||''),[tab,setTab]=useState('overview');
  const [rows,setRows]=useState<Row[]>([]),[campuses,setCampuses]=useState<Row[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
  const [report,setReport]=useState(reports[0]),[reportData,setReportData]=useState<Row|null>(null),[enabledReports,setEnabledReports]=useState<string[]>([]);
  const [from,setFrom]=useState(new Date().toISOString().slice(0,7)+'-01'),[to,setTo]=useState(new Date().toISOString().slice(0,10));
  const [setupLink,setSetupLink]=useState('');
  const cashRequest=useRef({payload:'',id:''});
  async function saveCash(data:Row){const payload=JSON.stringify({clientId,...data});if(cashRequest.current.payload!==payload)cashRequest.current={payload,id:crypto.randomUUID()};const result=await tenantApi('/petty_cash',clientId,{...data,amount:Number(data.amount),requestId:cashRequest.current.id});cashRequest.current={payload:'',id:''};return result;}
  useEffect(()=>{let active=true;tenantApi('/clients').then(data=>{if(active){setClients(data);if(!clientId&&!owner)setClientId(data[0]?.id||'');}}).catch(e=>active&&setError(e.message));return()=>{active=false;};},[reload]);
  useEffect(()=>{let active=true;setRows([]);setReportData(null);setSetupLink('');setError('');if(!clientId){setCampuses([]);return;}
    setBusy(true);
    (async()=>{
      const c=await tenantApi('/campuses',clientId);if(active)setCampuses(c);
      if(['overview','vouchers','reports'].includes(tab))return;
      if(tab==='report-policies'){const data=await tenantApi('/report-policies',clientId);if(active)setEnabledReports(data);return;}
      const data=await tenantApi('/'+tab,clientId);if(active)setRows(data);
    })().catch(e=>active&&setError(e.message)).finally(()=>active&&setBusy(false));
    return()=>{active=false;};
  },[clientId,tab,reload]);
  async function action(fn:()=>Promise<any>,message='Saved successfully.'){setError('');setNotice('');try{await fn();setNotice(message);setReload(x=>x+1);}catch(e:any){setError(e.message);throw e;}}
  // Form errors are presented in the page; do not leak rejected event promises.
  const submit=(fn:(data:Row)=>Promise<any>)=>async(data:Row)=>{try{await action(()=>fn(data));return true;}catch{return false;}};
  const campusOptions=campuses.map(c=>({value:c.id,label:c.name}));
  const tabs=['overview','vouchers','petty_cash','account_heads','campuses','reports',...(manager?['trash','invoices','users','periods','audit']:[]),...(owner?['report-policies']:[])];
  return <div className="secure-workspace min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
    <style>{`.secure-workspace input,.secure-workspace select{background:#0f172a;border:1px solid #475569;border-radius:6px;padding:8px;color:#f1f5f9;min-width:0}.secure-workspace button{background:#4338ca;padding:8px 12px;border-radius:6px;font-size:13px}.secure-workspace button:disabled{opacity:.45}.secure-workspace button:hover:not(:disabled){background:#4f46e5}@media print{.no-print{display:none!important}.secure-workspace{background:white!important;color:black!important}.secure-workspace th,.secure-workspace td{background:white!important;color:black!important}}`}</style>
    <header className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print"><div><h1 className="text-xl font-bold">School Financial Workspace</h1><p className="text-sm text-slate-400">{profile.name} · {owner?'Platform owner':manager?'Client administrator':'Campus account'}</p></div><div className="flex gap-2">{onLegacy&&<button onClick={onLegacy}>Legacy owner workspace</button>}<button onClick={onLogout}>Sign out</button></div></header>
    {owner&&<div className="no-print mb-4 flex flex-wrap gap-3 items-end"><label className="flex flex-col text-sm gap-1">Client organization<select value={clientId} onChange={e=>{setClientId(e.target.value);setNotice('');}}><option value="">Select a client</option>{clients.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><span className="text-sm text-slate-400">{clients.length} registered organizations</span></div>}
    {error&&<div role="alert" className="p-3 mb-3 bg-rose-950 border border-rose-700 rounded">{error}</div>}{notice&&<div role="status" className="p-3 mb-3 bg-emerald-950 rounded">{notice}</div>}
    {owner&&!clientId&&<section className="space-y-4 max-w-3xl"><h2 className="font-bold">Create a new organization</h2><p className="text-sm text-slate-400">Existing school data must be imported with the verified migration workflow. Creating an organization does not import or replace its records.</p><SimpleForm label="Create organization" fields={[{name:'id',label:'Unique client ID (letters, numbers, hyphens)'},{name:'name',label:'School / organization name'}]} onSubmit={submit(data=>tenantApi('/clients',undefined,data))}/><DataTable rows={clients}/></section>}
    {clientId&&<><nav className="flex gap-2 flex-wrap mb-5 no-print">{tabs.map(t=><button key={t} aria-pressed={t===tab} style={{background:t===tab?'#6366f1':'#1e293b'}} onClick={()=>setTab(t)}>{t.replaceAll('_',' ').replaceAll('-',' ')}</button>)}<button disabled={busy} onClick={()=>setReload(n=>n+1)}>Refresh</button></nav>
    <h2 className="text-lg font-bold mb-4">{clients.find(c=>c.id===clientId)?.name||'Organization'} · {tab.replaceAll('_',' ')}</h2>
    {busy?<p role="status">Loading verified records…</p>:<div className="space-y-4">
    {tab==='overview'&&<><p>{campuses.length} accessible campuses. Choose a module to view or enter records.</p><DataTable rows={campuses.map(c=>({code:c.code,name:c.name,status:c.status,parentCampusId:c.parentCampusId}))}/></>}
    {tab==='vouchers'&&<VoucherWorkspace key={clientId} clientId={clientId} campuses={campuses} manager={manager}/>}
    {tab==='campuses'&&manager&&<SimpleForm label="Create campus" fields={[{name:'code',label:'Campus code'},{name:'name',label:'Campus name'}]} onSubmit={submit(data=>tenantApi('/campuses',clientId,data))}/>}
    {tab==='account_heads'&&manager&&<SimpleForm label="Create account with permanent code" fields={[{name:'group',label:'Four-digit account group (e.g. 1001)'},{name:'name',label:'Account name'},{name:'category',label:'Category',options:['Asset','Liability','Equity','Revenue','Expense'].map(s=>({value:s,label:s}))}]} onSubmit={submit(data=>tenantApi('/account_heads',clientId,data))}/>}
    {tab==='petty_cash'&&<SimpleForm label="Record cash movement" fields={[{name:'campusId',label:'Campus',options:campusOptions},{name:'date',label:'Date',type:'date',value:to},{name:'direction',label:'Movement',options:(manager?[{value:'in',label:'Replenishment'},{value:'out',label:'Expense'}]:[{value:'out',label:'Expense'}])},{name:'amount',label:'Amount (PKR)',type:'number'},{name:'description',label:'Description'}]} onSubmit={submit(saveCash)}/>}
    {tab==='invoices'&&owner&&<SimpleForm label="Issue monthly invoice" fields={[{name:'month',label:'Billing month',type:'month',value:to.slice(0,7)},{name:'ratePerCampus',label:'Rate per active campus (PKR)',type:'number'}]} onSubmit={submit(data=>tenantApi('/invoices',clientId,{...data,ratePerCampus:Number(data.ratePerCampus)}))}/>}
    {tab==='periods'&&manager&&<SimpleForm label="Close accounting period" fields={[{name:'start',label:'Start date',type:'date'},{name:'end',label:'End date',type:'date'}]} onSubmit={submit(data=>tenantApi('/periods/close',clientId,data))}/>}
    {tab==='users'&&manager&&<><SimpleForm label="Create user account" fields={[{name:'name',label:'Full name'},{name:'email',label:'Email',type:'email'},{name:'campusId',label:'Assigned campus',options:campusOptions},{name:'permissionLevel',label:'Role',options:[...(owner?[{value:'level_2_client_super_admin',label:'Client administrator'}]:[]),{value:'level_3_main_campus_admin',label:'Main-campus administrator'},{value:'level_4_sub_campus_admin',label:'Sub-campus administrator'},{value:'level_5_departmental_staff',label:'Campus staff'}]}]} onSubmit={submit(data=>tenantApi('/users',clientId,data))}/><div className="flex gap-2 flex-wrap">{rows.filter(r=>r.status==='active').map(r=><button key={r.id} onClick={async()=>{setSetupLink('');try{const result=await tenantApi(`/users/${r.id}/setup-link`,clientId,{});setSetupLink(result.setupLink);}catch(e:any){setError(e.message);}}}>Issue setup link: {r.email}</button>)}</div>{setupLink&&<div className="p-4 border border-amber-600 rounded"><p className="text-sm mb-2">Private setup link. Share it only with the account holder. No email has been sent.</p><input className="w-full" aria-label="Private account setup link" readOnly value={setupLink}/><button onClick={()=>setSetupLink('')}>Hide link</button></div>}</>}
    {tab==='trash'&&rows.filter(r=>r.status==='deleted').map(r=><div key={r.id} className="flex gap-4 items-center border border-slate-800 p-3"><span>{r.original?.voucherNo||r.recordId} · {r.reason}</span><button onClick={()=>{void action(()=>tenantApi(`/trash/${r.id}/restore`,clientId,{}),'Record restored with its original ID.').catch(()=>{});}}>Restore</button></div>)}
    {tab==='reports'&&<><div className="flex gap-3 flex-wrap no-print"><label>Report<select aria-label="Report" value={report} onChange={e=>setReport(e.target.value)}>{reports.map(r=><option key={r}>{r}</option>)}</select></label><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button onClick={async()=>{setReportData(null);try{setReportData(await tenantApi(`/reports/${report}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,clientId));setError('');}catch(e:any){setError(e.message);}}}>Generate report</button></div>{reportData&&<><p>{reportData.key} · {reportData.from} to {reportData.to}</p><div className="flex gap-2 no-print"><DownloadCsv rows={reportData.rows} name={reportData.key}/><button onClick={()=>window.print()}>Print / Save PDF</button></div>{reportData.opening!==undefined&&<p>Opening PKR {reportData.opening.toFixed(2)} · Closing PKR {reportData.closing.toFixed(2)}</p>}<DataTable rows={reportData.rows}/></>}</>}
    {tab==='report-policies'&&<><p>Reports enabled for this client’s approved users:</p>{reports.map(r=><label className="block" key={r}><input type="checkbox" checked={enabledReports.includes(r)} onChange={e=>setEnabledReports(old=>e.target.checked?[...old,r]:old.filter(x=>x!==r))}/> {r}</label>)}<button onClick={()=>{void action(()=>tenantApi('/report-policies',clientId,{enabled:enabledReports},'PUT')).catch(()=>{});}}>Save report access</button></>}
    {!['overview','vouchers','reports','report-policies'].includes(tab)&&<><div className="no-print"><DownloadCsv rows={rows} name={tab}/></div><DataTable rows={rows}/></>}
    </div>}</>}
  </div>;
}

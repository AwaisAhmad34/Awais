import { Router, type RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { requireAuthentication } from '../authentication';
import { adminApp, adminDatabase } from '../adminFirebase';
import { DurableRepository } from './repository';
import { firestoreStore, type Store } from './store';
import { ApiError, tenantFor, identifier, requireManager, textField, revision, manages, dateField, type Context } from './policy';

export function createDurableRouter(store: Store = firestoreStore, authenticate: RequestHandler = requireAuthentication) {
  const router = Router(), repository = new DurableRepository(store);
  router.use(authenticate);
  const wrap = (fn: (req: any, res: any) => Promise<any>): RequestHandler => (req, res, next) => { Promise.resolve(fn(req,res)).catch(next); };
  const context = (res: any): Context => res.locals.tenantContext;
  const client = (req: any, res: any) => tenantFor(context(res), req.query.clientId);
  router.get('/context', (req,res) => res.json({ context:context(res), status:'ok' }));
  router.get('/clients', wrap(async(req,res) => res.json({data:await repository.clients(context(res))})));
  router.post('/clients', wrap(async(req,res) => res.status(201).json({data:await repository.createClient(context(res),req.body)})));
  for (const collection of ['campuses','vouchers','petty_cash','account_heads','invoices','trash','periods','audit']) {
    router.get(`/${collection}`, wrap(async(req,res) => res.json({data:await repository.list(context(res),client(req,res),collection)})));
  }
  router.post('/campuses', wrap(async(req,res) => res.status(201).json({data:await repository.createCampus(context(res),client(req,res),req.body)})));
  router.post('/account_heads', wrap(async(req,res) => res.status(201).json({data:await repository.createAccount(context(res),client(req,res),req.body)})));
  router.post('/vouchers', wrap(async(req,res) => res.status(201).json({data:await repository.saveVoucher(context(res),client(req,res),req.body)})));
  router.put('/vouchers/:id', wrap(async(req,res) => { const expected = revision(req.body); const {expectedRevision,...payload} = req.body; res.json({data:await repository.saveVoucher(context(res),client(req,res),payload,req.params.id,expected)}); }));
  router.delete('/vouchers/:id', wrap(async(req,res) => res.json({data:await repository.deleteVoucher(context(res),client(req,res),req.params.id,revision(req.body),req.body.reason)})));
  router.post('/trash/:id/restore', wrap(async(req,res) => res.json({data:await repository.restore(context(res),client(req,res),req.params.id)})));
  router.post('/petty_cash', wrap(async(req,res) => res.status(201).json({data:await repository.createPettyCash(context(res),client(req,res),req.body)})));
  router.post('/invoices', wrap(async(req,res) => res.status(201).json({data:await repository.issueInvoice(context(res),client(req,res),req.body)})));
  router.post('/periods/close', wrap(async(req,res) => res.json({data:await repository.closePeriod(context(res),client(req,res),req.body)})));
  router.get('/report-policies', wrap(async(req,res) => {
    const id = client(req,res); requireManager(context(res));
    const rows = await store.transaction(tx=>tx.get(`organizations/${id}/settings/reports`));
    res.json({data:rows?.enabled || []});
  }));
  router.put('/report-policies', wrap(async(req,res) => {
    if (!context(res).isPlatformAdmin) throw new ApiError(403,'OWNER_REQUIRED');
    const id=client(req,res), enabled=req.body.enabled;
    if (!Array.isArray(enabled) || enabled.some((s:any)=>!['ledger','trial-balance','income-expense','cash-book'].includes(s))) throw new ApiError(400,'INVALID_REPORT_POLICY');
    await store.transaction(async tx=> { if (!await tx.get(`organizations/${id}`)) throw new ApiError(404,'NOT_FOUND'); tx.set(`organizations/${id}/settings/reports`, {enabled:[...new Set(enabled)], updatedBy:context(res).userId, updatedAt:new Date().toISOString()}); });
    res.json({data:enabled});
  }));
  router.get('/reports/:key', wrap(async(req,res) => {
    const id=client(req,res), ctx=context(res), key=req.params.key;
    if (!['ledger','trial-balance','income-expense','cash-book'].includes(key)) throw new ApiError(404,'REPORT_NOT_FOUND');
    const from=req.query.from?dateField(req.query.from):'0000-01-01', to=req.query.to?dateField(req.query.to):'9999-12-31';
    if(from>to)throw new ApiError(400,'INVALID_DATE_RANGE');
    const policy=await store.transaction(tx=>tx.get(`organizations/${id}/settings/reports`));
    if(!ctx.isPlatformAdmin && !policy?.enabled?.includes(key))throw new ApiError(403,'REPORT_DISABLED');
    // Every source is filtered through the same tenant/campus authorization.
    if(key==='cash-book') {
      const all=await repository.list(ctx,id,'petty_cash');
      const before=all.filter(r=>r.date<from), rows=all.filter(r=>r.date>=from&&r.date<=to).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt));
      let balance=before.reduce((s,r)=>s+(r.direction==='in'?1:-1)*Math.round(r.amount*100),0);
      const opening=balance/100;
      res.json({data:{key,from,to,opening,rows:rows.map(r=>({...r,runningBalance:(balance+=(r.direction==='in'?1:-1)*Math.round(r.amount*100))/100})),closing:balance/100}}); return;
    }
    const vouchers=(await repository.list(ctx,id,'vouchers')).filter(v=>v.status==='Posted'&&v.date>=from&&v.date<=to).sort((a,b)=>a.date.localeCompare(b.date)||a.voucherNo.localeCompare(b.voucherNo));
    const accounts=await repository.list(ctx,id,'account_heads');
    const totals=new Map<string,any>();
    const ledger=vouchers.flatMap(v=>v.entries.map((e:any)=>({...e,date:v.date,voucherNo:v.voucherNo,campusId:v.campusId,id:v.id})));
    for(const entry of ledger){const account=accounts.find(a=>a.code===entry.accountCode); const row=totals.get(entry.accountCode)||{accountCode:entry.accountCode,name:account?.name||entry.accountCode,category:account?.category||'Unknown',debitCents:0,creditCents:0};row.debitCents+=Math.round(entry.debit*100);row.creditCents+=Math.round(entry.credit*100);totals.set(entry.accountCode,row);}
    const trial=[...totals.values()].sort((a,b)=>a.accountCode.localeCompare(b.accountCode,undefined,{numeric:true})).map(r=>({accountCode:r.accountCode,name:r.name,category:r.category,debit:r.debitCents/100,credit:r.creditCents/100,balance:(r.debitCents-r.creditCents)/100}));
    const rows=key==='ledger'?ledger:key==='income-expense'?trial.filter(r=>['Revenue','Expense'].includes(r.category)):trial;
    res.json({data:{key,from,to,rows,postedVoucherCount:vouchers.length,totalDebit:ledger.reduce((s,r)=>s+Math.round(r.debit*100),0)/100,totalCredit:ledger.reduce((s,r)=>s+Math.round(r.credit*100),0)/100}});
  }));
  // Account provisioning uses Firebase Authentication, never browser-local passwords.
  router.get('/users',wrap(async(req,res)=>{
    const ctx=context(res), id=client(req,res); requireManager(ctx);
    const records=await adminDatabase().collection('memberships').where('clientId','==',id).get();
    res.json({data:records.docs.map(d=>({id:d.id,name:d.data().name,email:d.data().email,permissionLevel:d.data().permissionLevel,campusId:d.data().campusId,status:d.data().status}))});
  }));
  router.post('/users',wrap(async(req,res)=>{
    const ctx=context(res), id=client(req,res);requireManager(ctx);
    const role=req.body.permissionLevel;
    const roles=ctx.isPlatformAdmin?['level_2_client_super_admin','level_3_main_campus_admin','level_4_sub_campus_admin','level_5_departmental_staff']:['level_3_main_campus_admin','level_4_sub_campus_admin','level_5_departmental_staff'];
    if(!roles.includes(role))throw new ApiError(403,'ROLE_NOT_DELEGABLE');
    const campuses=await repository.list(ctx,id,'campuses');
    const campusId=identifier(req.body.campusId);if(!campuses.some(c=>c.id===campusId))throw new ApiError(403,'CAMPUS_ACCESS_DENIED');
    const email=textField(req.body.email,'Email',254).toLowerCase(), name=textField(req.body.name,'Name',120);
    const auth=getAuth(adminApp()), uid=randomUUID();
    await auth.createUser({uid,email,displayName:name});
    try {
      await adminDatabase().collection('memberships').doc(uid).create({name,email,clientId:id,campusId,permissionLevel:role,status:'active',createdBy:ctx.userId,createdAt:new Date().toISOString()});
    } catch(error) { await auth.deleteUser(uid).catch(()=>{});throw error; }
    // No email is sent. The administrator can issue setup separately if needed.
    res.status(201).json({data:{id:uid,email,name,status:'active',message:'Account created. Use Issue setup link to let the user set their password.'}});
  }));
  router.post('/users/:id/setup-link',wrap(async(req,res)=>{
    const ctx=context(res), id=client(req,res);requireManager(ctx);
    const uid=identifier(req.params.id), membership=await adminDatabase().collection('memberships').doc(uid).get();
    const m=membership.data();if(!m||m.clientId!==id||m.status!=='active')throw new ApiError(404,'NOT_FOUND');
    if(!ctx.isPlatformAdmin&&m.permissionLevel==='level_2_client_super_admin')throw new ApiError(403,'OWNER_REQUIRED');
    const setupLink=await getAuth(adminApp()).generatePasswordResetLink(m.email);
    res.json({data:{setupLink}});
  }));
  router.use((error:any,_req:any,res:any,_next:any)=> {
    const status=error.status||error.statusCode;
    if (status && status>=400 && status<500) return res.status(status).json({error:error.code||'REQUEST_REJECTED',message:error.message});
    if(error.code==='auth/email-already-exists')return res.status(409).json({error:'EMAIL_EXISTS',message:'This email already has an account. Link its verified membership through the administrator.'});
    console.error('Tenant API failure',error.code||error.name||'unknown');
    res.status(503).json({error:'SERVICE_UNAVAILABLE',message:'The datastore or identity service is unavailable. No successful save has been confirmed.'});
  });
  return router;
}

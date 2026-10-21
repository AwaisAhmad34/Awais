/** Read-only inventory. Never writes Firebase or assigns ambiguous records. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const [sourcePath,mappingPath,outputPath]=process.argv.slice(2);
if(!sourcePath||!mappingPath||!outputPath)throw new Error('Usage: node --import tsx scripts/migration/plan.ts export.json campus-map.json plan.json');
const raw=readFileSync(sourcePath), source=JSON.parse(raw.toString()), mapping=JSON.parse(readFileSync(mappingPath,'utf8'));
if(!source||Array.isArray(source)||typeof source!=='object'||!mapping||Array.isArray(mapping))throw new Error('Export and campus mapping must be JSON objects.');
const inventory:Record<string,any>={}, blockers:string[]=[];
// Require the owner to identify each original campus; never infer the first client.
for(const [collection,records] of Object.entries(source)){
 if(!Array.isArray(records)){blockers.push(`${collection}: nested/non-array data requires a schema adapter`);continue;}
 const ids=new Set<string>();const clients:Record<string,number>={};
 for(const [index,record] of records.entries()){
  if(!record||typeof record!=='object'){blockers.push(`${collection}[${index}]: invalid record`);continue;}
  if(!record.id||ids.has(record.id))blockers.push(`${collection}[${index}]: missing or duplicate original ID`);else ids.add(record.id);
  const campus=collection==='campuses'?record.id:record.campusId;
  const client=campus?mapping[campus]:undefined;
  if(!client||typeof client!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(client))blockers.push(`${collection}[${index}]: explicit campus/client mapping required`);
  else if(record.clientId&&record.clientId!==client)blockers.push(`${collection}[${index}]: existing client conflicts with mapping`);
  else clients[client]=(clients[client]||0)+1;
 }
 inventory[collection]={count:records.length,clients};
}
const plan={sourceSha256:createHash('sha256').update(raw).digest('hex'),generatedAt:new Date().toISOString(),mode:'inventory-only',inventory,blockers,readyToImport:false,nextStep:'Review schema, resolve every mapping, reconcile financial totals, and test a copy in staging. This inventory does not authorize or perform import.'};
writeFileSync(outputPath,JSON.stringify(plan,null,2),{flag:'wx',mode:0o600});
console.log(`Inventory saved. ${blockers.length} unresolved mapping/schema checks. Source unchanged.`);

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(root,'data'),bucket='nerd4salegaming-data',apply=process.argv.includes('--apply');
const files=[];
async function walk(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file);else if(entry.isFile())files.push(file)}}
try{await walk(data)}catch(e){if(e.code==='ENOENT'){console.error('No local data folder found. Upload inventory through admin instead.');process.exit(1)}throw e}
const plan=[];
for(const file of files){const rel=path.relative(data,file).split(path.sep).join('/');if(rel.endsWith('.tmp'))continue;if(rel==='prices.json')continue;plan.push({file,key:rel==='inventory.json'?'inventory/current.json':rel})}
console.log('Target R2 bucket:',bucket);console.log('Matching keys will be overwritten. Confirm the correct Cloudflare account before applying.');for(const row of plan)console.log(row.key);console.log(plan.length+' files.');
if(!apply){console.log('Plan only. Run again with --apply to upload.');process.exit(0)}
for(const row of plan){const command=path.join(root,'node_modules','wrangler','bin','wrangler.js');const result=spawnSync(process.execPath,[command,'r2','object','put',bucket+'/'+row.key,'--file',row.file,'--remote'],{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1)}
console.log('Migration complete. Price cache will repopulate automatically.');

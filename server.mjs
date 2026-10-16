import * as noteRoute from './local-vendor-note.mjs';
import * as eventsRoute from './local-events.mjs';
import * as sealedRoute from './local-sealed.mjs';
import * as buylists from './local-buylists.mjs';
import * as buyquote from './local-buylist-quote.mjs';
import {GET as getCarts,POST as postCart,PATCH as patchCart,DELETE as deleteCart} from './local-carts.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inventoryFromCSV} from './csv.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const data=path.join(root,'data');await fs.mkdir(data,{recursive:true});
const inventoryPath=path.join(data,'inventory.json');const cachePath=path.join(data,'prices.json');
async function read(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw e}}
async function save(file,value){await fs.writeFile(file+'.tmp',JSON.stringify(value,null,2));await fs.rename(file+'.tmp',file)}
let priceCache=await read(cachePath,{});let fetching=Promise.resolve();
const port=Number(process.env.PORT||3000);const host='127.0.0.1';
function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function body(req){let total=0;const parts=[];for await(const chunk of req){total+=chunk.length;if(total>10000000)throw Error('CSV must be under 10 MB');parts.push(chunk)}return Buffer.concat(parts).toString('utf8')}
const server=http.createServer(async(req,res)=>{
 try{
 if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(req.headers.host)){json(res,{error:'Invalid host'},403);return}
 const url=new URL(req.url,`http://${req.headers.host}`);
 if(['/api/vendor-note','/api/events','/api/buylists','/api/buylist-quote','/api/sealed'].includes(url.pathname)){let payload;if(!['GET','HEAD'].includes(req.method)){const parts=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>(url.pathname==='/api/sealed'?10000000:5500000))throw Error('Upload too large');parts.push(chunk)}payload=Buffer.concat(parts)}const request=new Request(url,{method:req.method,headers:req.headers,...(payload?{body:payload}:{})});const route=url.pathname==='/api/vendor-note'?noteRoute:url.pathname==='/api/events'?eventsRoute:url.pathname==='/api/sealed'?sealedRoute:url.pathname==='/api/buylists'?buylists:buyquote;const fn=route[req.method];const response=fn?await fn(request):new Response('',{status:405});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return}
 if(url.pathname==='/api/carts'){const request=new Request(url,{method:req.method,headers:req.headers,...(['POST','PATCH','DELETE'].includes(req.method)?{body:await body(req)}:{})});const response=req.method==='GET'?await getCarts(request):req.method==='POST'?await postCart(request):req.method==='PATCH'?await patchCart(request):req.method==='DELETE'?await deleteCart(request):new Response('',{status:405});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return}
 if(url.pathname==='/api/inventory'){
 if(req.method==='GET')return json(res,await read(inventoryPath,{cards:null}));
 if(req.method!=='PUT')return json(res,{error:'Method not allowed'},405);
 if(![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin))return json(res,{error:'Invalid origin'},403);
 const cards=inventoryFromCSV(await body(req));if(!cards.length)throw Error('No in-stock cards found. Existing inventory retained.');await save(inventoryPath,{cards,updatedAt:new Date().toISOString()});return json(res,{count:cards.length});
 }
 if(url.pathname==='/api/prices'){
 const ids=[...new Set((url.searchParams.get('ids')||'').split(',').filter(Boolean))];const stock=await read(inventoryPath,{cards:[]});const allowed=new Set((stock.cards||[]).map(c=>c.id));if(ids.length>25||!ids.length||ids.some(id=>!allowed.has(id)||!/^[0-9a-f-]{36}$/i.test(id)))return json(res,{error:'Invalid inventory IDs'},400);
 const task=async()=>{const missing=ids.filter(id=>!priceCache[id]||Date.now()-priceCache[id].fetchedAt>86400000);if(missing.length){const response=await fetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','User-Agent':'Nerd4SaleGamingLocal/1.0'},body:JSON.stringify({identifiers:missing.map(id=>({id}))}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Pricing provider unavailable');const payload=await response.json();for(const card of payload.data||[])priceCache[card.id]={...card.prices,fetchedAt:Date.now()};for(const id of missing)priceCache[id]??={usd:null,usd_foil:null,usd_etched:null,fetchedAt:Date.now()};await save(cachePath,priceCache);await new Promise(resolve=>setTimeout(resolve,550))}};
 const current=fetching.then(task);fetching=current.catch(()=>{});try{await current}catch{}return json(res,{prices:Object.fromEntries(ids.filter(id=>priceCache[id]).map(id=>[id,priceCache[id]]))});
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return json(res,{error:'Method not allowed'},405);
 const files={'/admin-tabs.js':'admin-tabs.js','/vendor-note.js':'vendor-note.js','/note-admin.js':'note-admin.js','/events.js':'events.js','/events-admin.js':'events-admin.js','/sealed-admin.js':'sealed-admin.js','/buylist.js':'buylist.js','/csv.js':'csv.js','/buylist-csv.js':'buylist-csv.js','/buylist-admin.js':'buylist-admin.js','/':'index.html','/admin':'admin.html','/admin/':'admin.html','/catalog.js':'catalog.js','/style.css':'style.css','/nerd-4-sale-logo.png':'nerd-4-sale-logo.png'};const name=files[url.pathname];if(!name)return json(res,{error:'Not found'},404);const bytes=await fs.readFile(path.join(root,'public',name));const ext=path.extname(name);res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png'}[ext],'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(e){json(res,{error:e.message||'Request failed'},400)}
});
server.listen(port,host,()=>console.log(`Nerd 4 Sale Gaming\nWebsite: http://${host}:${port}\nAdmin: http://${host}:${port}/admin\nKeep this window open. Press Ctrl+C to stop.`));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is busy. Close the other copy or set PORT to another number.`:e.message);process.exitCode=1});

export async function refreshPrices(base){
 const inventory=await fetch(base+'/api/inventory',{signal:AbortSignal.timeout(30000)});if(!inventory.ok)throw Error('Inventory unavailable');const {cards}=await inventory.json();const ids=[...new Set((cards||[]).map(c=>c.id).filter(id=>/^[0-9a-f-]{36}$/i.test(id)))];let checked=0;
 for(let i=0;i<ids.length;i+=25){const batch=ids.slice(i,i+25);const r=await fetch(base+'/api/prices?ids='+batch.join(','),{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Pricing request failed: '+r.status);const d=await r.json();if(d.error)throw Error(d.error);if(batch.some(id=>!d.prices?.[id]))throw Error('Incomplete price response');checked+=batch.length;await new Promise(resolve=>setTimeout(resolve,150))}
 return {checked};
}
if(process.argv[1]?.endsWith('refresh-prices.mjs')){refreshPrices(process.argv[2]||'http://127.0.0.1:3000').then(console.log).catch(e=>{console.error(e.message);process.exitCode=1})}

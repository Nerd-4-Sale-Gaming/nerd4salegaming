(async()=>{
 const root=document.getElementById('show-events');if(!root)return;
 const date=s=>new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
 const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n};
 try{const r=await fetch('/api/events');if(!r.ok)throw Error();const {events}=await r.json();const today=new Date().toLocaleDateString('en-CA');const upcoming=events.filter(e=>(e.endDate||e.date)>=today);root.replaceChildren();document.getElementById('shows-badge').textContent=upcoming.length?upcoming.length+' UPCOMING':'DATES COMING SOON';
 if(!upcoming.length){root.append(el('strong','Next stops are being lined up.'),el('p','No upcoming events are listed yet. Check back for our next vending appearance.'));return}
 for(const e of upcoming){const card=el('article','');card.className='show-event';card.append(el('h3',e.name),el('strong',date(e.date)+(e.endDate&&e.endDate!==e.date?' – '+date(e.endDate):'')));if(e.hours)card.append(el('p',e.hours));card.append(el('p',e.venue),el('p',e.address));if(e.details){const p=el('p',e.details);p.style.whiteSpace='pre-wrap';card.append(p)}if(e.url&&/^https?:\/\//i.test(e.url)){const a=el('a','Event details ↗');a.href=e.url;a.target='_blank';a.rel='noopener noreferrer';a.className='pill';card.append(a)}root.append(card)}
 }catch{root.replaceChildren(el('p','Unable to load shows right now. Please contact us for upcoming appearances.'))}
})();

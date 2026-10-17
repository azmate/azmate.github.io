const V='azmate-v2';
const ASSETS=['./','index.html','styles.css','config.js','main.js','board.js','clock.js','i18n.js','network.js','online.js','pieces.js','settings.js','sound.js','logo.png','favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET')return;
  if(u.origin!==location.origin&&!/(^|\.)(cdnjs\.cloudflare\.com|unpkg\.com)$/.test(u.hostname))return;
  e.respondWith(fetch(r).then(res=>{if(res.ok||res.type==='opaque'){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));}return res;}).catch(()=>caches.match(r)));
});

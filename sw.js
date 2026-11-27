const CACHE_NAME="thuca-reader-refresh-v1";
const CORE_FILES=[
 "./",
 "./index.html",
 "./styles.css",
 "./app.js",
 "./cloud-sync.js",
 "./supabase-config.js",
 "./assets/thu-ca-mark.svg",
 "./assets/mermaid-mini.svg",
 "./assets/mermaid-scholar.svg"
];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("thuca-")&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET")return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 if(req.mode==="navigate"){
  event.respondWith(fetch(req).then(response=>{
   const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put("./index.html",copy));return response;
  }).catch(()=>caches.match("./index.html").then(hit=>hit||caches.match("./"))));
  return;
 }
 if(/\.(?:js|css|svg)$/.test(url.pathname)){
  event.respondWith(fetch(req).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(req,copy))}
   return response;
  }).catch(()=>caches.match(req)));
 }
});

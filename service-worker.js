const CACHE="fixcit-shell-v1";
const FILES=["./","./index.html","./submit.html","./reports.html","./track.html","./profile.html","./login.html","./styles.css","./app.js","./manifest.json"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting();});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener("fetch",e=>{
    if(e.request.method!=="GET")return;
    const u=new URL(e.request.url);if(u.pathname.includes("/api/"))return;
    e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(res=>{
    if(res.ok&&u.origin===location.origin)caches.open(CACHE).then(c=>c.put(e.request,res.clone()));
    return res;
    }).catch(()=>caches.match("./index.html"))));
});

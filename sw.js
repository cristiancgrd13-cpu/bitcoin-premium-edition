/* Kosmara: service worker mínimo.
   - La página y las traducciones van siempre primero a la red (así ves la última versión) y usan la copia guardada solo sin conexión.
   - Logos e iconos se sirven desde la caché y se refrescan en segundo plano.
   - Nunca guarda llamadas a APIs ni a otros dominios: precios, saldos y firmas son siempre en vivo. */
var V="kz-v1",SHELL=["./020.html","./manifest.webmanifest","./icons/icon-192.png"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(V).then(function(c){return c.addAll(SHELL)}).catch(function(){}));self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(K){return Promise.all(K.filter(function(k){return k!==V}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener("fetch",function(e){var r=e.request,u=new URL(r.url);
 if(r.method!=="GET"||u.origin!==location.origin)return;
 var page=r.mode==="navigate"||/\.(html|json|webmanifest)$/.test(u.pathname);
 if(page){e.respondWith(fetch(r).then(function(res){if(res.ok){var cp=res.clone();caches.open(V).then(function(c){c.put(r,cp)})}return res}).catch(function(){return caches.match(r,{ignoreSearch:true}).then(function(m){return m||caches.match("./020.html")})}));return}
 if(/\.(png|svg|webp|jpg|ico)$/.test(u.pathname)){e.respondWith(caches.open(V).then(function(c){return c.match(r).then(function(m){var n=fetch(r).then(function(res){if(res.ok)c.put(r,res.clone());return res}).catch(function(){return m});return m||n})}))}
});

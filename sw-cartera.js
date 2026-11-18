/* Mi cartera (009.html): service worker mínimo, separado del de Kosmara.
   - La página va siempre primero a la red (ves la última versión con tus compras) y usa la copia guardada solo sin conexión.
   - Los iconos se sirven desde la caché y se refrescan en segundo plano.
   - Nunca guarda llamadas a APIs ni a otros dominios: los precios son siempre en vivo. */
var V="mc-v1",SHELL=["./009.html","./cartera/manifest.webmanifest","./cartera/icon-192.png"];
self.addEventListener("install",function(e){e.waitUntil(caches.open(V).then(function(c){return c.addAll(SHELL)}).catch(function(){}));self.skipWaiting()});
self.addEventListener("activate",function(e){e.waitUntil(caches.keys().then(function(K){return Promise.all(K.filter(function(k){return k.indexOf("mc-")===0&&k!==V}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener("fetch",function(e){var r=e.request,u=new URL(r.url);
 if(r.method!=="GET"||u.origin!==location.origin)return;
 if(r.mode==="navigate"||/\.(html|webmanifest)$/.test(u.pathname)){e.respondWith(fetch(r).then(function(res){if(res.ok){var cp=res.clone();caches.open(V).then(function(c){c.put(r,cp)})}return res}).catch(function(){return caches.match(r,{ignoreSearch:true}).then(function(m){return m||caches.match("./009.html")})}));return}
 if(/\/cartera\/.*\.png$/.test(u.pathname)){e.respondWith(caches.open(V).then(function(c){return c.match(r).then(function(m){var n=fetch(r).then(function(res){if(res.ok)c.put(r,res.clone());return res}).catch(function(){return m});return m||n})}))}
});

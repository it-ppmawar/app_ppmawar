module.exports=[4446,(e,a,t)=>{a.exports=e.x("net",()=>require("net"))},55004,(e,a,t)=>{a.exports=e.x("tls",()=>require("tls"))},92509,(e,a,t)=>{a.exports=e.x("url",()=>require("url"))},54799,(e,a,t)=>{a.exports=e.x("crypto",()=>require("crypto"))},88947,(e,a,t)=>{a.exports=e.x("stream",()=>require("stream"))},874,(e,a,t)=>{a.exports=e.x("buffer",()=>require("buffer"))},51615,(e,a,t)=>{a.exports=e.x("node:buffer",()=>require("node:buffer"))},93695,(e,a,t)=>{a.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},24361,(e,a,t)=>{a.exports=e.x("util",()=>require("util"))},18622,(e,a,t)=>{a.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,a,t)=>{a.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,a,t)=>{a.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,a,t)=>{a.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},70406,(e,a,t)=>{a.exports=e.x("next/dist/compiled/@opentelemetry/api",()=>require("next/dist/compiled/@opentelemetry/api"))},49,e=>{"use strict";var a=e.i(47909),t=e.i(74017),r=e.i(96250),s=e.i(59756),n=e.i(61916),i=e.i(74677),o=e.i(69741),l=e.i(16795),u=e.i(87718),d=e.i(95169),m=e.i(47587),p=e.i(66012),_=e.i(70101),c=e.i(26937),E=e.i(10372),k=e.i(93695);e.i(52474);var N=e.i(220),R=e.i(89171),f=e.i(43793);async function x(){try{let e={},[a]=await f.default.execute(`
      SELECT u.id, u.username, u.nama, u.role, u.kamar_id, 
             k.nama_kamar, k.nama_asrama
      FROM users u
      LEFT JOIN kamar k ON u.kamar_id = k.kamar_id
      WHERE u.role IN ('pengurus_asrama', 'staff_asrama', 'ketua_asrama')
      LIMIT 20
    `);e.pengurus_users=a;let[t]=await f.default.execute(`
      SELECT role, COUNT(*) as jumlah FROM users GROUP BY role ORDER BY jumlah DESC
    `);e.all_roles=t;let[r]=await f.default.execute(`
      SELECT id, username, nama, role, kamar_id 
      FROM users 
      WHERE username LIKE '%asrama%' OR nama LIKE '%asrama%' 
      LIMIT 15
    `);e.users_with_asrama=r;let[s]=await f.default.execute(`
      SELECT k.kamar_id, k.nama_kamar, k.nama_asrama, 
             COUNT(m.murid_id) as jumlah_santri
      FROM kamar k
      LEFT JOIN murid m ON m.kamar_id = k.kamar_id
      GROUP BY k.kamar_id
      ORDER BY k.nama_asrama, k.nama_kamar
    `);e.kamar_list=s,e.distinct_asrama=[...new Set(s.map(e=>e.nama_asrama).filter(Boolean))];let[n]=await f.default.execute(`
      SELECT jq.id, jq.hari, jq.jam_mulai, jq.jam_selesai, jq.mata_pelajaran,
             jq.kelas_quran_id, kq.nama_kelas
      FROM jadwal_quran jq
      LEFT JOIN kelas_quran kq ON jq.kelas_quran_id = kq.id
      ORDER BY jq.hari, jq.jam_mulai
    `);e.jadwal_quran=n,e.jadwal_quran_total=n.length;let[i]=await f.default.execute(`
      SELECT kq.id, kq.nama_kelas, COUNT(m.murid_id) as jumlah_santri
      FROM kelas_quran kq
      LEFT JOIN murid m ON m.kelas_quran_id = kq.id
      GROUP BY kq.id
      ORDER BY kq.nama_kelas
    `);for(let t of(e.kelas_quran=i,e.simulate_resolve_asrama=[],a.slice(0,5))){let a={user_id:t.id,username:t.username,nama:t.nama,role:t.role};if(t.kamar_id){let[e]=await f.default.execute("SELECT k.nama_asrama FROM users u JOIN kamar k ON u.kamar_id = k.kamar_id WHERE u.id = ? AND k.nama_asrama IS NOT NULL AND k.nama_asrama != '' LIMIT 1",[t.id]);a.step1_kamar_asrama=e.length>0?e[0].nama_asrama:null}else a.step1_kamar_asrama=null,a.step1_note="kamar_id IS NULL";let r=t.nama?t.nama.match(/asrama\s+([a-z])/i):null;a.step2_nama_match=r?`Asrama ${r[1].toUpperCase()}`:null;let s=t.username.match(/asrama[_\-\s]?([a-f])(?:[_\-\s]|$)/i),n=t.username.match(/asrama.*?([a-f])(?:\b|_|$)/i);if(a.step3_username_match=s?`Asrama ${s[1].toUpperCase()}`:n?`Asrama ${n[1].toUpperCase()}`:null,a.resolved_asrama=a.step1_kamar_asrama||a.step2_nama_match||a.step3_username_match||"NULL - TIDAK TERDETEKSI!",a.step1_kamar_asrama||a.step2_nama_match||a.step3_username_match){let e=a.step1_kamar_asrama||a.step2_nama_match||a.step3_username_match,[t]=await f.default.execute(`SELECT COUNT(*) as total FROM jadwal_quran WHERE kelas_quran_id IN (
            SELECT DISTINCT m.kelas_quran_id FROM murid m
            JOIN kamar km ON m.kamar_id = km.kamar_id
            WHERE km.nama_asrama = ? AND m.kelas_quran_id IS NOT NULL
          )`,[e]);a.jadwal_quran_count=t[0].total;let[r]=await f.default.execute(`SELECT DISTINCT kq.id, kq.nama_kelas, COUNT(m.murid_id) as santri_asrama
           FROM murid m
           JOIN kamar km ON m.kamar_id = km.kamar_id
           JOIN kelas_quran kq ON m.kelas_quran_id = kq.id
           WHERE km.nama_asrama = ? AND m.kelas_quran_id IS NOT NULL
           GROUP BY kq.id`,[e]);a.kelas_quran_for_asrama=r}e.simulate_resolve_asrama.push(a)}let[o]=await f.default.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN foto IS NULL OR foto = '' OR foto = '-' THEN 1 ELSE 0 END) as tanpa_foto,
        SUM(CASE WHEN foto LIKE 'Berkas_%' THEN 1 ELSE 0 END) as foto_berkas,
        SUM(CASE WHEN foto LIKE 'http%' THEN 1 ELSE 0 END) as foto_url,
        SUM(CASE WHEN foto IS NOT NULL AND foto != '' AND foto != '-' 
             AND foto NOT LIKE 'Berkas_%' AND foto NOT LIKE 'http%' THEN 1 ELSE 0 END) as foto_lokal
      FROM murid
    `);e.foto_stats=o[0];let[l]=await f.default.execute(`
      SELECT murid_id, nama, foto 
      FROM murid 
      WHERE foto IS NOT NULL AND foto != '' AND foto != '-'
      LIMIT 10
    `);e.foto_samples=l;let[u]=await f.default.execute(`
      SELECT
        COUNT(*) as total_santri,
        SUM(CASE WHEN kelas_quran_id IS NULL OR kelas_quran_id = 0 THEN 1 ELSE 0 END) as tanpa_kelas_quran,
        SUM(CASE WHEN kelas_quran_id IS NOT NULL AND kelas_quran_id != 0 THEN 1 ELSE 0 END) as punya_kelas_quran
      FROM murid
    `);e.santri_quran_stats=u[0];let[d]=await f.default.execute("SHOW COLUMNS FROM murid");return e.murid_columns=d.map(e=>({field:e.Field,type:e.Type})),R.NextResponse.json({success:!0,data:e},{headers:{"Cache-Control":"no-store"}})}catch(e){return R.NextResponse.json({success:!1,error:e.message},{status:500})}}e.s(["GET",0,x],45419);var h=e.i(45419);let q=new a.AppRouteRouteModule({definition:{kind:t.RouteKind.APP_ROUTE,page:"/api/debug/diagnosa/route",pathname:"/api/debug/diagnosa",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/debug/diagnosa/route.ts",nextConfigOutput:"",userland:h,...{}}),{workAsyncStorage:O,workUnitAsyncStorage:T,serverHooks:C}=q;async function S(e,a,r){r.requestMeta&&(0,s.setRequestMeta)(e,r.requestMeta),q.isDev&&(0,s.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let R="/api/debug/diagnosa/route";R=R.replace(/\/index$/,"")||"/";let f=await q.prepare(e,a,{srcPage:R,multiZoneDraftMode:!1});if(!f)return a.statusCode=400,a.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:x,params:h,nextConfig:O,parsedUrl:T,isDraftMode:C,prerenderManifest:S,routerServerContext:w,isOnDemandRevalidate:v,revalidateOnlyGenerated:g,resolvedPathname:L,clientReferenceManifest:I,serverActionsManifest:A}=f,U=(0,o.normalizeAppPath)(R),j=!!(S.dynamicRoutes[U]||S.routes[L]),y=async()=>((null==w?void 0:w.render404)?await w.render404(e,a,T,!1):a.end("This page could not be found"),null);if(j&&!C){let e=!!S.routes[L],a=S.dynamicRoutes[U];if(a&&!1===a.fallback&&!e){if(O.adapterPath)return await y();throw new k.NoFallbackError}}let M=null;!j||q.isDev||C||(M="/index"===(M=L)?"/":M);let b=!0===q.isDev||!j,D=j&&!b;A&&I&&(0,i.setManifestsSingleton)({page:R,clientReferenceManifest:I,serverActionsManifest:A});let H=e.method||"GET",P=(0,n.getTracer)(),F=P.getActiveScopeSpan(),B=!!(null==w?void 0:w.isWrappedByNextServer),W=!!(0,s.getRequestMeta)(e,"minimalMode"),K=(0,s.getRequestMeta)(e,"incrementalCache")||await q.getIncrementalCache(e,O,S,W);null==K||K.resetRequestCache(),globalThis.__incrementalCache=K;let $={params:h,previewProps:S.preview,renderOpts:{experimental:{authInterrupts:!!O.experimental.authInterrupts},cacheComponents:!!O.cacheComponents,supportsDynamicResponse:b,incrementalCache:K,cacheLifeProfiles:O.cacheLife,waitUntil:r.waitUntil,onClose:e=>{a.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(a,t,r,s)=>q.onRequestError(e,a,r,s,w)},sharedContext:{buildId:x}},G=new l.NodeNextRequest(e),J=new l.NodeNextResponse(a),Y=u.NextRequestAdapter.fromNodeNextRequest(G,(0,u.signalFromNodeResponse)(a));try{let s,i=async e=>q.handle(Y,$).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":a.statusCode,"next.rsc":!1});let t=P.getRootSpanAttributes();if(!t)return;if(t.get("next.span_type")!==d.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${t.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let r=t.get("next.route");if(r){let a=`${H} ${r}`;e.setAttributes({"next.route":r,"http.route":r,"next.span_name":a}),e.updateName(a),s&&s!==e&&(s.setAttribute("http.route",r),s.updateName(a))}else e.updateName(`${H} ${R}`)}),o=async s=>{var n,o;let l=async({previousCacheEntry:t})=>{try{if(!W&&v&&g&&!t)return a.statusCode=404,a.setHeader("x-nextjs-cache","REVALIDATED"),a.end("This page could not be found"),null;let n=await i(s);e.fetchMetrics=$.renderOpts.fetchMetrics;let o=$.renderOpts.pendingWaitUntil;o&&r.waitUntil&&(r.waitUntil(o),o=void 0);let l=$.renderOpts.collectedTags;if(!j)return await (0,p.sendResponse)(G,J,n,$.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),a=(0,_.toNodeOutgoingHttpHeaders)(n.headers);l&&(a[E.NEXT_CACHE_TAGS_HEADER]=l),!a["content-type"]&&e.type&&(a["content-type"]=e.type);let t=void 0!==$.renderOpts.collectedRevalidate&&!($.renderOpts.collectedRevalidate>=E.INFINITE_CACHE)&&$.renderOpts.collectedRevalidate,r=void 0===$.renderOpts.collectedExpire||$.renderOpts.collectedExpire>=E.INFINITE_CACHE?void 0:$.renderOpts.collectedExpire;return{value:{kind:N.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:a},cacheControl:{revalidate:t,expire:r}}}}catch(a){throw(null==t?void 0:t.isStale)&&await q.onRequestError(e,a,{routerKind:"App Router",routePath:R,routeType:"route",revalidateReason:(0,m.getRevalidateReason)({isStaticGeneration:D,isOnDemandRevalidate:v})},!1,w),a}},u=await q.handleResponse({req:e,nextConfig:O,cacheKey:M,routeKind:t.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:S,isRoutePPREnabled:!1,isOnDemandRevalidate:v,revalidateOnlyGenerated:g,responseGenerator:l,waitUntil:r.waitUntil,isMinimalMode:W});if(!j)return null;if((null==u||null==(n=u.value)?void 0:n.kind)!==N.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==u||null==(o=u.value)?void 0:o.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});W||a.setHeader("x-nextjs-cache",v?"REVALIDATED":u.isMiss?"MISS":u.isStale?"STALE":"HIT"),C&&a.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let d=(0,_.fromNodeOutgoingHttpHeaders)(u.value.headers);return W&&j||d.delete(E.NEXT_CACHE_TAGS_HEADER),!u.cacheControl||a.getHeader("Cache-Control")||d.get("Cache-Control")||d.set("Cache-Control",(0,c.getCacheControlHeader)(u.cacheControl)),await (0,p.sendResponse)(G,J,new Response(u.value.body,{headers:d,status:u.value.status||200})),null};B&&F?await o(F):(s=P.getActiveScopeSpan(),await P.withPropagatedContext(e.headers,()=>P.trace(d.BaseServerSpan.handleRequest,{spanName:`${H} ${R}`,kind:n.SpanKind.SERVER,attributes:{"http.method":H,"http.target":e.url}},o),void 0,!B))}catch(a){if(a instanceof k.NoFallbackError||await q.onRequestError(e,a,{routerKind:"App Router",routePath:U,routeType:"route",revalidateReason:(0,m.getRevalidateReason)({isStaticGeneration:D,isOnDemandRevalidate:v})},!1,w),j)throw a;return await (0,p.sendResponse)(G,J,new Response(null,{status:500})),null}}e.s(["handler",0,S,"patchFetch",0,function(){return(0,r.patchFetch)({workAsyncStorage:O,workUnitAsyncStorage:T})},"routeModule",0,q,"serverHooks",0,C,"workAsyncStorage",0,O,"workUnitAsyncStorage",0,T],49)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__09t864b._.js.map
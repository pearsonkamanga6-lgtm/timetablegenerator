const json=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});

const appManifest={
 id:"/",name:"School Timetable Maker",short_name:"Timetable",description:"Create school, class and teacher timetables.",
 start_url:"/",scope:"/",display:"standalone",orientation:"any",background_color:"#F7F9FC",theme_color:"#082D73",lang:"en",
 icons:[{src:"/app-icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},{src:"/app-icon-512.png",sizes:"512x512",type:"image/png",purpose:"any maskable"}],
 categories:["education","productivity"]
};
const serviceWorkerCode='self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));self.addEventListener("fetch",e=>{if(e.request.mode!=="navigate"||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).catch(()=>new Response("<!doctype html><meta name=viewport content=width=device-width><title>Timetable - offline</title><body style=font-family:Arial;padding:24px><h1>School Timetable Maker</h1><p>Connect to the internet, then reopen the app to access your protected timetable.</p><button onclick=location.reload()>Retry</button></body>",{status:503,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}})));});';
function pngChunk(name,data){const out=new Uint8Array(data.length+12),view=new DataView(out.buffer);view.setUint32(0,data.length);for(let i=0;i<4;i++)out[4+i]=name.charCodeAt(i);out.set(data,8);let crc=0xffffffff;for(let i=4;i<8+data.length;i++){crc^=out[i];for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}view.setUint32(8+data.length,(crc^0xffffffff)>>>0);return out}
async function appIcon(size){
 const stride=size*3+1,rows=new Uint8Array(stride*size);
 const navy=[8,45,115],gold=[245,180,0],letters=[["11111","00100","00100","00100","00100","00100","00100"],["11111","00100","00100","00100","00100","00100","00100"]];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){let px=x/size,py=y/size;const dx=Math.max(.23-px,0,px-.77),dy=Math.max(.23-py,0,py-.77);const inside=(dx*dx+dy*dy)<.065*.065;let color=inside?gold:navy;if(inside){const gx=Math.floor((px-.235)/.046),gy=Math.floor((py-.34)/.046);if(gy>=0&&gy<7&&gx>=0&&gx<11){const letter=gx<5?0:gx>5?1:-1,ix=letter===0?gx:gx-6;if(letter>=0&&letters[letter][gy][ix]==="1")color=navy;}}rows.set(color,y*stride+1+x*3)}
 const ihdr=new Uint8Array(13),v=new DataView(ihdr.buffer);v.setUint32(0,size);v.setUint32(4,size);ihdr[8]=8;ihdr[9]=2;
 const compressed=new Uint8Array(await new Response(new Blob([rows]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer());
 return new Blob([new Uint8Array([137,80,78,71,13,10,26,10]),pngChunk("IHDR",ihdr),pngChunk("IDAT",compressed),pngChunk("IEND",new Uint8Array())],{type:"image/png"});
}
async function publicInstallAsset(req){
 if(req.method!=="GET"&&req.method!=="HEAD")return null;
 const path=new URL(req.url).pathname,head=req.method==="HEAD";const schoolManifest=path.match(/^\/s\/([a-z0-9-]{3,48})\/manifest\.webmanifest$/);
 if(path==="/manifest.webmanifest"||schoolManifest){const manifest=schoolManifest?{...appManifest,id:"/s/"+schoolManifest[1]+"/",start_url:"/s/"+schoolManifest[1]+"/",scope:"/s/"+schoolManifest[1]+"/"}:appManifest;return new Response(head?null:JSON.stringify(manifest),{headers:{"Content-Type":"application/manifest+json; charset=utf-8","Cache-Control":"public, max-age=300","X-Content-Type-Options":"nosniff"}});}
 if(path==="/sw.js")return new Response(head?null:serviceWorkerCode,{headers:{"Content-Type":"application/javascript; charset=utf-8","Cache-Control":"no-cache","Service-Worker-Allowed":"/","X-Content-Type-Options":"nosniff"}});
 if(path==="/app-icon-192.png"||path==="/app-icon-512.png"){const size=path.includes("192")?192:512;return new Response(head?null:await appIcon(size),{headers:{"Content-Type":"image/png","Cache-Control":"public, max-age=86400","X-Content-Type-Options":"nosniff"}});}
 return null;
}


const slugPattern=/^[a-z0-9][a-z0-9-]{2,47}$/;
async function secretHash(slug,password){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("school-timetable-v1:"+slug+":"+password));return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,"0")).join("")}
function sameSecret(a,b){if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
function challenge(slug){return new Response("Authentication required",{status:401,headers:{"WWW-Authenticate":'Basic realm="Timetable '+(slug||"owner")+'"',"Cache-Control":"no-store"}})}
async function provisionSchool(req,env,url){
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 if(req.headers.get("Origin")!==url.origin||!req.headers.get("Content-Type")?.startsWith("application/json"))return json({error:"Same-origin JSON required"},403);
 const raw=await req.text();if(raw.length>4096)return json({error:"Request too large"},413);let body;try{body=JSON.parse(raw)}catch{return json({error:"Invalid JSON"},400)}
 const slug=String(body?.slug||"").trim().toLowerCase(),name=String(body?.name||"").trim();
 if(!slugPattern.test(slug)||!name||name.length>150)return json({error:"Provide a school name and a 3–48 character school ID (letters, numbers, hyphens)."},400);
 await env.DB.prepare("CREATE TABLE IF NOT EXISTS school_accounts (slug TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, revision INTEGER NOT NULL, state_json TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
 const password=Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,"0")).join(""),hash=await secretHash(slug,password),now=new Date().toISOString();
 const state={version:2,schoolName:name,days:["Monday","Tuesday","Wednesday","Thursday","Friday"],periodsPerDay:9,breakAfter:5,classes:[],teachers:[],subjects:[],allocations:[],unavailable:{},schedule:[],lastGeneration:null};
 const r=await env.DB.prepare("INSERT INTO school_accounts(slug,secret_hash,revision,state_json,updated_at) VALUES(?,?,1,?,?) ON CONFLICT(slug) DO NOTHING").bind(slug,hash,JSON.stringify(state),now).run();
 if(r.meta.changes!==1)return json({error:"That school ID is already in use."},409);
 return json({schoolId:slug,username:slug,password,url:url.origin+"/s/"+slug+"/",accessLink:url.origin+"/s/"+slug+"/#access="+password},201);
}

export default {async fetch(req,env){
 const installationAsset=await publicInstallAsset(req);if(installationAsset)return installationAsset;
 const url=new URL(req.url),route=url.pathname.match(/^\/s\/([a-z0-9][a-z0-9-]{2,47})(\/.*)?$/),slug=route?.[1]||null,path=route?(route[2]||"/"):url.pathname;
 const shell=path==="/"&&(req.method==="GET"||req.method==="HEAD");
 if(shell){if(slug&&!route[2])return Response.redirect(url.origin+"/s/"+slug+"/",302);const r=await env.ASSETS.fetch(new Request(new URL("/",url.origin),req));const h=new Headers(r.headers);h.set("Cache-Control","private, no-store");h.set("Referrer-Policy","no-referrer");return new Response(r.body,{status:r.status,headers:h});}
 let username="",password="";try{const h=req.headers.get("Authorization")||"";if(h.startsWith("Basic ")){const a=atob(h.slice(6)),i=a.indexOf(":");if(i>=0){username=a.slice(0,i);password=a.slice(i+1)}}}catch{}
 if(slug){
  if(path==="/api/access"){
   if(req.method!=="POST"||req.headers.get("Origin")!==url.origin||!req.headers.get("Content-Type")?.startsWith("application/json"))return json({error:"Invalid access request"},403);
   let b;try{const raw=await req.text();if(raw.length>1024)return json({error:"Invalid access request"},400);b=JSON.parse(raw)}catch{return json({error:"Invalid access request"},400)}
   const token=b?.token;if(typeof token!=="string"||!/^[0-9a-f]{48}$/.test(token))return json({error:"Invalid private link"},403);
   try{const row=await env.DB.prepare("SELECT secret_hash FROM school_accounts WHERE slug=?").bind(slug).first();if(!row||!sameSecret(row.secret_hash,await secretHash(slug,token)))return json({error:"Invalid private link"},403);
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store","Set-Cookie":"school_access="+token+"; Path=/s/"+slug+"/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000"}});
   }catch{return json({error:"School access unavailable"},503)}
  }
  const token=(req.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("school_access="))?.slice(14);
  if(token&&/^[0-9a-f]{48}$/.test(token)){username=slug;password=token;}
  if(!env.DB)return json({error:"Database unavailable"},503);
  if(username!==slug||password.length!==48||!(/^[0-9a-f]{48}$/.test(password)))return json({error:"Open your private school access link first."},401);
  let account;try{account=await env.DB.prepare("SELECT secret_hash FROM school_accounts WHERE slug=?").bind(slug).first()}catch{return challenge(slug)}
  if(!account||!sameSecret(account.secret_hash,await secretHash(slug,password)))return json({error:"Open your private school access link first."},401);
 }else{
  if(!env.TIMETABLE_PASSWORD)return json({error:"Server password not configured"},503);
  if(username!=="school"||!sameSecret(password,env.TIMETABLE_PASSWORD))return challenge(null);
 }
 if(path==="/api/admin/schools"){if(slug)return json({error:"Forbidden"},403);if(!env.DB)return json({error:"Database unavailable"},503);try{return await provisionSchool(req,env,url)}catch(e){console.error("School provisioning failed");return json({error:"School provisioning failed"},500)}}
 if(path!=="/api/timetable"){if(path.startsWith("/api/")||slug&&path!=="/")return json({error:"Not found"},404);if(slug&&!route[2])return Response.redirect(url.origin+"/s/"+slug+"/",302);const assetReq=slug||path==="/owner/"?new Request(new URL("/",url.origin),req):req;const r=await env.ASSETS.fetch(assetReq);const h=new Headers(r.headers);h.set("Cache-Control","private, no-store");return new Response(r.body,{status:r.status,headers:h});}
 if(!env.DB)return json({error:"Database binding DB not configured"},503);
 try{
 if(req.method==="GET"){const row=slug?await env.DB.prepare("SELECT revision,state_json,updated_at FROM school_accounts WHERE slug=?").bind(slug).first():await env.DB.prepare("SELECT revision,state_json,updated_at FROM timetable WHERE id=1").first();return json(row?{revision:row.revision,state:JSON.parse(row.state_json),updatedAt:row.updated_at}:{revision:0,state:null,updatedAt:null});}
 if(req.method!=="PUT")return json({error:"Method not allowed"},405);
 if(req.headers.get("Origin")!==url.origin)return json({error:"Origin not allowed"},403);
 if(!req.headers.get("Content-Type")?.startsWith("application/json"))return json({error:"JSON required"},415);
 const raw=await req.text();if(new TextEncoder().encode(raw).length>2000000)return json({error:"Backup too large"},413);
 let body;try{body=JSON.parse(raw)}catch{return json({error:"Invalid JSON"},400)}
 const {revision,state:s}=body||{};
 if(!Number.isSafeInteger(revision)||revision<0||!s||s.version!==2||typeof s.schoolName!=="string"||!["classes","teachers","subjects","allocations","days","schedule"].every(k=>Array.isArray(s[k]))||!s.days.length||!Number.isInteger(s.periodsPerDay)||s.periodsPerDay<3||s.periodsPerDay>14||!Number.isInteger(s.breakAfter)||s.breakAfter<0||s.breakAfter>=s.periodsPerDay||!s.unavailable||typeof s.unavailable!=="object"||Array.isArray(s.unavailable))return json({error:"Invalid timetable or revision"},400);
 const next=revision+1,updatedAt=new Date().toISOString(),state=JSON.stringify(s);
 const r=slug?await env.DB.prepare("UPDATE school_accounts SET revision=?,state_json=?,updated_at=? WHERE slug=? AND revision=?").bind(next,state,updatedAt,slug,revision).run():revision===0?await env.DB.prepare("INSERT INTO timetable(id,revision,state_json,updated_at) VALUES(1,?,?,?) ON CONFLICT(id) DO NOTHING").bind(next,state,updatedAt).run():await env.DB.prepare("UPDATE timetable SET revision=?,state_json=?,updated_at=? WHERE id=1 AND revision=?").bind(next,state,updatedAt,revision).run();
 if(r.meta.changes!==1)return json({error:"Revision conflict: newer cloud data exists. Local data retained."},409);
 return json({revision:next,updatedAt});
 }catch(e){console.error(e);return json({error:"Database operation failed"},500);}
}};

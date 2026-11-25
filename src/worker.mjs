const json=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export default {async fetch(req,env){
 if(!env.TIMETABLE_PASSWORD)return json({error:"Server password not configured"},503);
 let auth=false;try{auth=atob((req.headers.get("Authorization")||"").replace(/^Basic /,""))==="school:"+env.TIMETABLE_PASSWORD}catch{}
 if(!auth)return new Response("Authentication required",{status:401,headers:{"WWW-Authenticate":'Basic realm="ZamBright Timetable"',"Cache-Control":"no-store"}});
 const url=new URL(req.url);
 if(url.pathname!=="/api/timetable"){if(url.pathname.startsWith("/api/"))return json({error:"Not found"},404);const r=await env.ASSETS.fetch(req);const h=new Headers(r.headers);h.set("Cache-Control","private, no-store");return new Response(r.body,{status:r.status,headers:h});}
 if(!env.DB)return json({error:"Database binding DB not configured"},503);
 try{
 if(req.method==="GET"){const row=await env.DB.prepare("SELECT revision,state_json,updated_at FROM timetable WHERE id=1").first();return json(row?{revision:row.revision,state:JSON.parse(row.state_json),updatedAt:row.updated_at}:{revision:0,state:null,updatedAt:null});}
 if(req.method!=="PUT")return json({error:"Method not allowed"},405);
 if(req.headers.get("Origin")!==url.origin)return json({error:"Origin not allowed"},403);
 if(!req.headers.get("Content-Type")?.startsWith("application/json"))return json({error:"JSON required"},415);
 const raw=await req.text();if(new TextEncoder().encode(raw).length>2000000)return json({error:"Backup too large"},413);
 let body;try{body=JSON.parse(raw)}catch{return json({error:"Invalid JSON"},400)}
 const {revision,state:s}=body||{};
 if(!Number.isSafeInteger(revision)||revision<0||!s||s.version!==2||typeof s.schoolName!=="string"||!["classes","teachers","subjects","allocations","days","schedule"].every(k=>Array.isArray(s[k]))||!s.days.length||!Number.isInteger(s.periodsPerDay)||s.periodsPerDay<3||s.periodsPerDay>14||!Number.isInteger(s.breakAfter)||s.breakAfter<0||s.breakAfter>=s.periodsPerDay||!s.unavailable||typeof s.unavailable!=="object"||Array.isArray(s.unavailable))return json({error:"Invalid timetable or revision"},400);
 const next=revision+1,updatedAt=new Date().toISOString(),state=JSON.stringify(s);
 const r=revision===0?await env.DB.prepare("INSERT INTO timetable(id,revision,state_json,updated_at) VALUES(1,?,?,?) ON CONFLICT(id) DO NOTHING").bind(next,state,updatedAt).run():await env.DB.prepare("UPDATE timetable SET revision=?,state_json=?,updated_at=? WHERE id=1 AND revision=?").bind(next,state,updatedAt,revision).run();
 if(r.meta.changes!==1)return json({error:"Revision conflict: newer cloud data exists. Local data retained."},409);
 return json({revision:next,updatedAt});
 }catch(e){console.error(e);return json({error:"Database operation failed"},500);}
}};

// Local integration harness only. Do not deploy this server.
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../src/worker.mjs';
const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../migrations/0001_timetable.sql',import.meta.url),'utf8'));
const env={TIMETABLE_PASSWORD:'local-test-only',DB:{prepare(sql){let params=[];return {bind(...p){params=p;return this},async first(){return sqlite.prepare(sql).get(...params)??null},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...params).changes)}}}}}},ASSETS:{fetch:async()=>new Response(readFileSync(new URL('../public/index.html',import.meta.url)),{headers:{'Content-Type':'text/html'}})}};
http.createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const response=await worker.fetch(new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,...(req.method==='GET'||req.method==='HEAD'?{}:{body})}),env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(e){res.writeHead(500);res.end(String(e))}}).listen(8765,'127.0.0.1');

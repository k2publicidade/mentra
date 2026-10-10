import {createOnlineRuntime} from '../server/online-runtime.js';
let app;
// Lazy configuration, no listener, no local database fallback on serverless.
export default async function handler(req,res){
 try{app??=createOnlineRuntime();}catch{res.statusCode=503;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify({error:'Backend online não configurado.'}));return;}
 return app(req,res);
}

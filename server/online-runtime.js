import {Pool} from 'pg';
import {createOnlineApp} from './online-app.js';
import {createSupabaseAuth} from './supabase-auth.js';
export function onlineConfig(env){
 for(const name of ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','DATABASE_URL','SESSION_SECRET','APP_ORIGIN'])if(!env[name])throw Error(`Missing ${name} configuration.`);
 const origin=new URL(env.APP_ORIGIN);if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Invalid APP_ORIGIN configuration.');
 const database=new URL(env.DATABASE_URL);if(!['postgres:','postgresql:'].includes(database.protocol))throw Error('Invalid DATABASE_URL configuration.');
 // SSL query parameters can override node-postgres ssl options; reject rather than silently weaken verification.
 for(const name of ['sslmode','sslcert','sslkey','sslrootcert'])if(database.searchParams.has(name))throw Error('Remove SSL query parameters from DATABASE_URL; verified TLS is configured by the server.');
 if(env.SESSION_SECRET.length<64)throw Error('Invalid SESSION_SECRET configuration.');
 return {origin:origin.origin,sessionSecret:env.SESSION_SECRET,auth:{url:env.SUPABASE_URL,key:env.SUPABASE_ANON_KEY,serviceKey:env.SUPABASE_SERVICE_ROLE_KEY},pool:{connectionString:env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,ssl:{rejectUnauthorized:true,...(env.DATABASE_CA_CERT?{ca:env.DATABASE_CA_CERT.replace(/\\n/g,'\n')}: {})}}};
}
export function createOnlineRuntime(env=process.env){
 const config=onlineConfig(env),auth=createSupabaseAuth(config.auth),pool=new Pool(config.pool);
 // Do not print connection strings or Auth tokens on background pool errors.
 pool.on('error',()=>{});
 // Keep browser recordings below Vercel's 4.5 MB function payload limit.
 const app=createOnlineApp({pool,auth,origin:config.origin,sessionSecret:config.sessionSecret,voiceOptions:{maxBytes:4000000}});
 // Vercel supplies the immediate trusted proxy; never trust arbitrary-length forwarded chains.
 app.set('trust proxy',1);app.locals.pool=pool;return app;
}

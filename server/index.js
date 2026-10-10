import {createApp} from './app.js';
import {createServer as createHttpsServer} from 'node:https';
import {createServer as createHttpServer} from 'node:http';
import {readFileSync} from 'node:fs';
export {createApp} from './app.js';
const port=Number(process.env.PORT??3000);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT inválida');
const host=process.env.HOST||'127.0.0.1';
const certPath=process.env.TLS_CERT_PATH,keyPath=process.env.TLS_KEY_PATH;
if(Boolean(certPath)!==Boolean(keyPath))throw new Error('Configure TLS_CERT_PATH e TLS_KEY_PATH juntos.');
const tls=certPath?{cert:readFileSync(certPath),key:readFileSync(keyPath)}:null;
// Direct HTTPS always uses Secure cookies, even for local device testing.
if(tls)process.env.NODE_ENV='production';
const app=createApp();
const server=tls?createHttpsServer(tls,app):createHttpServer(app);
server.listen(port,host,()=>console.log(`MENTRA LIFE disponível em ${tls?'https':'http'}://${host.includes(':')?'['+host+']':host}:${server.address().port}`));
server.on('error',error=>{console.error('Não foi possível iniciar o servidor:',error.message);app.locals.db.close();process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close(()=>{app.locals.db.close();process.exit(0);});setTimeout(()=>process.exit(1),5000).unref();});

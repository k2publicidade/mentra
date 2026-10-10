import {fail} from './online-validation.js';
// Auth is always checked with GoTrue; never trust a decoded JWT or client owner ID.
export function createSupabaseAuth({url,key,serviceKey,transport=fetch,allowLoopback=false}){
 const base=new URL(url);if(base.protocol!=='https:'&&!(allowLoopback&&base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname)))throw Error('Supabase URL must use HTTPS.');
 if(base.username||base.password||base.pathname!=='/'||base.search||base.hash||!key||!serviceKey)throw Error('Invalid Supabase Auth configuration.');
 const call=async(path,{method='POST',body,token,admin=false,nullable=false}={})=>{
  let response;try{response=await transport(new URL('/auth/v1/'+path,base),{method,headers:{apikey:admin?serviceKey:key,Authorization:`Bearer ${token||(admin?serviceKey:key)}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(10000)});}catch{fail(502,'O serviço de autenticação não está disponível.');}
  if(nullable&&[401,403].includes(response.status)){await response.body?.cancel();return null;}
  if(!response.ok){await response.body?.cancel();const status=response.status===429?429:response.status>=500?502:[400,401,403,422].includes(response.status)?(path.startsWith('token?grant_type=password')?401:400):502;fail(status,status===429?'Muitas tentativas. Aguarde.':status===401?'E-mail ou senha incorretos ou e-mail ainda não confirmado.':status===400?'Não foi possível autenticar. Verifique os dados e a confirmação do e-mail.':'O serviço de autenticação não está disponível.');}
  const chunks=[];let bytes=0;for await(const b of response.body||[]){bytes+=b.byteLength;if(bytes>65536)fail(502,'Resposta inválida do serviço de autenticação.');chunks.push(Buffer.from(b));}
  if(!bytes)return {};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail(502,'Resposta inválida do serviço de autenticação.');}
 };
 const tokens=async(p,b)=>{const r=await call(p,{body:b});if(typeof r.access_token!=='string'||typeof r.refresh_token!=='string')fail(502,'Não foi possível confirmar a sessão.');return r;};
 return {
  login:(email,password)=>tokens('token?grant_type=password',{email,password}),
  refresh:refresh_token=>tokens('token?grant_type=refresh_token',{refresh_token}),
  signup:async body=>{const result=await call('signup',{body});if(!(typeof result?.access_token==='string'&&typeof result.refresh_token==='string')&&!(typeof (result?.user||result)?.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((result?.user||result)?.id)))fail(502,'Resposta inválida do serviço de autenticação.');return result;},
  user:async token=>{if(typeof token!=='string'||!token)return null;const r=await call('user',{method:'GET',token,nullable:true});if(!r)return null;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id)||typeof r.email!=='string')fail(502,'Identidade inválida do serviço de autenticação.');return {id:r.id,email:r.email};},
  logout:token=>call('logout',{token}),
  deleteUser:id=>call('admin/users/'+encodeURIComponent(id),{method:'DELETE',admin:true,body:{should_soft_delete:false}}),
 };
}

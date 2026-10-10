import {test,expect} from '@playwright/test';
test('pending Supabase confirmation stays on login and never loads authenticated data',async({page})=>{
 const requested=[];await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;requested.push(path);await route.fulfill({status:path==='/api/auth/register'?202:401,contentType:'application/json',body:JSON.stringify(path==='/api/auth/register'?{user:null,confirmationRequired:true,message:'Confira seu e-mail para confirmar o cadastro. Depois entre na sua conta.'}:{error:'Entre na sua conta.'})});});
 await page.goto('/');await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await page.getByLabel('Seu nome',{exact:true}).fill('Ana');await page.getByLabel('E-mail',{exact:true}).fill('ana@example.com');await page.getByLabel('Senha',{exact:true}).fill('long-password');await page.getByRole('button',{name:'Criar meu espaço'}).click();
 await expect(page.getByRole('status')).toContainText('Confira seu e-mail');await expect(page.getByRole('button',{name:'Entrar',exact:true}).last()).toBeVisible();
 expect(requested.filter(x=>!x.startsWith('/api/auth/'))).toEqual([]);
});

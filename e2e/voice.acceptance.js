// Contract/browser tests with synthetic microphone and LOCAL provider only.
// This does not prove recognition accuracy or contact BRAINIALL/OpenAI.
import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';
async function openChat(page){
 const r=await page.request.post('/api/auth/register',{data:{name:'Voz Teste',email:`voice-${crypto.randomUUID()}@example.com`,password:crypto.randomBytes(20).toString('hex'),timezone:'America/Sao_Paulo'}});expect(r.status()).toBe(201);
 await page.request.patch('/api/profile',{data:{onboarded:true}});
 await page.goto('/');await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Mentra',exact:true}).click();
 await page.getByRole('button',{name:'Usar áudio',exact:true}).click();
 page.on('dialog',d=>d.accept());
}
async function record(page){
 await page.getByRole('checkbox',{name:'Autorizo o microfone e a transcrição externa'}).check();
 await page.getByRole('button',{name:'Gravar áudio',exact:true}).click();
 // Actual capture interval: permits MediaRecorder to produce nonempty media.
 await expect(page.getByRole('button',{name:'Parar gravação',exact:true})).toBeVisible();
 await page.waitForTimeout(900);
 await page.getByRole('button',{name:'Parar gravação',exact:true}).click();
 await expect(page.locator('audio[controls]')).toBeVisible();
 await expect.poll(()=>page.locator('audio[controls]').evaluate(audio=>audio.readyState)).toBeGreaterThanOrEqual(1);
 expect(await page.locator('audio[controls]').evaluate(audio=>audio.error)).toBeNull();
}
test('grava bytes reais, transcreve apenas ao solicitar, revisão precede persistência',async({page})=>{
 await page.setViewportSize({width:390,height:844});await openChat(page);
 const before=await (await page.request.get('/__test/voice-evidence')).json();
 await record(page);
 expect((await (await page.request.get('/__test/voice-evidence')).json()).calls).toBe(before.calls);
 expect((await (await page.request.get('/api/items')).json()).items).toHaveLength(0);
 await page.getByRole('button',{name:'Transcrever áudio',exact:true}).click();
 await expect(page.getByLabel('Mensagem para a Mentra')).toHaveValue('Preciso revisar o contrato.');
 const evidence=await (await page.request.get('/__test/voice-evidence')).json();
 expect(evidence.calls).toBe(before.calls+1);expect(evidence.uploads.at(-1).hasAudioField).toBeTruthy();expect(evidence.uploads.at(-1).hasPt).toBeTruthy();expect(evidence.uploads.at(-1).hasWebmMagic).toBeTruthy();expect(evidence.uploads.at(-1).size).toBeGreaterThan(100);
 expect((await (await page.request.get('/api/items')).json()).items).toHaveLength(0);
 await page.getByLabel('Mensagem para a Mentra').fill('Preciso revisar o contrato revisado.');
 await page.getByRole('button',{name:/Enviar mensagem/}).click();
 await expect(page.locator('.message.assistant')).toContainText('Salvei:');
 const items=(await (await page.request.get('/api/items')).json()).items;expect(items).toHaveLength(1);expect(items[0].type).toBe('task');expect(items[0].title).toContain('contrato revisado');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:'test-results/voice-mobile.png',fullPage:true});
 await page.request.delete('/api/account',{data:{confirmation:'EXCLUIR'}});
});
test('falha de transcrição preserva áudio e não confirma tarefa salva',async({page})=>{
 await openChat(page);await record(page);
 await page.route('**/api/voice/transcribe',route=>route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'Falha controlada do fornecedor; confira o consumo antes de repetir.'})}));
 await page.getByRole('button',{name:'Transcrever áudio',exact:true}).click();
 await expect(page.getByText(/Falha controlada do fornecedor/)).toBeVisible();
 await expect(page.locator('audio[controls]')).toBeVisible();
 await expect.poll(()=>page.locator('audio[controls]').evaluate(audio=>audio.readyState)).toBeGreaterThanOrEqual(1);
 expect(await page.locator('audio[controls]').evaluate(audio=>audio.error)).toBeNull();
 expect((await (await page.request.get('/api/items')).json()).items).toHaveLength(0);
 await page.getByRole('button',{name:'Descartar áudio',exact:true}).click();
 await expect(page.locator('audio[controls]')).toHaveCount(0);
 await page.request.delete('/api/account',{data:{confirmation:'EXCLUIR'}});
});

import {test, expect} from '@playwright/test';
import crypto from 'node:crypto';
import {dayKey,shiftDay} from '../src/ux.js';
import {zonedInputToISO} from '../src/lib.js';
test.use({locale:'pt-BR'});
async function shot(page,name,fullPage=false) {
  await expect(page.getByRole('button',{name:'Atualizar registros'})).toBeEnabled();
  const confirmation = page.getByRole('button',{name:'Fechar confirmação'});
  if (await confirmation.count()) await confirmation.click();
  await page.evaluate(()=>{ document.querySelector('#main')?.focus({preventScroll:true}); window.scrollTo(0,0); });
  for (const img of await page.locator('.artwork img').all()) {
    if (await img.isVisible()) await expect.poll(()=>img.evaluate(node=>node.complete && node.naturalWidth > 0)).toBeTruthy();
  }
  await page.screenshot({path:`test-results/${name}.png`,fullPage,animations:'disabled'});
}

test('mobile agenda, quick creation, persistent filters/draft, history and app installation', async ({page}) => {
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:844});
  const timezone='America/Sao_Paulo', today=dayKey(Date.now(),timezone);
  const result=await page.request.post('/api/auth/register',{data:{name:'Marina',email:`ux-${crypto.randomUUID()}@example.com`,password:crypto.randomBytes(20).toString('hex'),timezone}});
  expect(result.status()).toBe(201);
  try {
  await page.request.patch('/api/profile',{data:{onboarded:true}});
  const seed=[
    {type:'event',title:'Conversa com a equipe',dueAt:zonedInputToISO(`${today}T10:00`,timezone)},
    {type:'task',title:'Revisar proposta do café',priority:true,dueAt:zonedInputToISO(`${shiftDay(today,-1)}T14:00`,timezone)},
    {type:'reminder',title:'Enviar documentos',dueAt:zonedInputToISO(`${shiftDay(today,1)}T09:00`,timezone)},
    {type:'task',title:'Separar ideias para o projeto',notes:'Um passo de cada vez.'},
    {type:'memory',title:'Ideia para o próximo encontro',source:'Minha anotação',notes:'Um lugar tranquilo para conversar.'},
  ];
  for(const data of seed) expect((await page.request.post('/api/items',{data})).ok()).toBeTruthy();
  await page.goto('/');
  const nav=page.getByRole('navigation',{name:'Navegação principal'});
  await expect(page.getByRole('heading',{name:'Sua agenda',exact:true})).toBeVisible();
  const agenda=page.locator('.section-block').filter({has:page.getByRole('heading',{name:'Sua agenda',exact:true})});
  await expect(agenda.locator('.item-row')).toHaveCount(1);
  await expect(agenda).toContainText('Conversa com a equipe');
  await page.getByRole('button',{name:'Próximo dia',exact:true}).click();
  await expect(agenda).toContainText('Enviar documentos');
  await page.getByRole('button',{name:'Adicionar registro',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Título',{exact:true}).fill('Preparar apresentação');
  await dialog.getByRole('button',{name:'Amanhã',exact:true}).click();
  await dialog.getByRole('button',{name:'Salvar registro',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(agenda).toContainText('Preparar apresentação');
  await expect(page.locator('.toast')).toContainText('salv');
  await page.getByRole('button',{name:'Desfazer',exact:true}).click();
  await expect(agenda).not.toContainText('Preparar apresentação');
  await shot(page,'ux-today-mobile');
  await page.getByLabel('Dia da agenda').fill(shiftDay(today,2));
  await agenda.locator('.empty-art').scrollIntoViewIfNeeded();
  await expect.poll(()=>agenda.locator('.empty-art img').evaluate(img=>img.complete && img.naturalWidth > 0)).toBeTruthy();
  await page.screenshot({path:'test-results/artwork-agenda-mobile.png',fullPage:false,animations:'disabled'});
  await nav.getByRole('button',{name:'Vida',exact:true}).click();
  await page.getByLabel('Buscar registros').fill('cafe');
  await page.getByRole('button',{name:'Prioridades',exact:true}).click();
  await expect(page.locator('.item-row')).toHaveCount(1);
  await nav.getByRole('button',{name:'Mentra',exact:true}).click();
  await page.getByLabel('Mensagem para a Mentra').fill('Uma ideia que ainda estou organizando');
  await shot(page,'ux-chat-mobile');
  await nav.getByRole('button',{name:'Vida',exact:true}).click();
  await expect(page.getByLabel('Buscar registros')).toHaveValue('cafe');
  await expect(page.locator('.item-row')).toHaveCount(1);
  await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();
  await page.getByLabel('Ordenar registros').selectOption('title');
  await expect(page.locator('.item-row').first()).toContainText('Conversa com a equipe');
  await shot(page,'ux-life-mobile');
  await page.goBack();
  await expect(page.getByLabel('Mensagem para a Mentra')).toHaveValue('Uma ideia que ainda estou organizando');
  await nav.getByRole('button',{name:'Eu',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar à tela inicial',exact:true}).click();
  await expect(page.locator('.install-help')).toContainText('Safari');
  await shot(page,'ux-account-mobile',true);
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    for(const name of ['Hoje','Vida','Mentra','Eu']) {
      await nav.getByRole('button',{name,exact:true}).click();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth),`${name} at ${width}px`).toBeTruthy();
    }
  }
  await nav.getByRole('button',{name:'Hoje',exact:true}).click();
  await shot(page,'ux-today-desktop',true);
  await nav.getByRole('button',{name:'Vida',exact:true}).click();
  await shot(page,'ux-life-desktop',true);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Adicionar registro',exact:true}).click();
  await dialog.getByLabel('Título',{exact:true}).fill('Rascunho protegido');
  page.once('dialog',d=>d.dismiss());
  await dialog.getByRole('button',{name:'Fechar formulário'}).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Título',{exact:true})).toHaveValue('Rascunho protegido');
  await dialog.getByRole('button',{name:'Salvar registro',exact:true}).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button',{name:'Fechar formulário'})).toBeFocused();
  await expect(page.locator('.sidebar')).toHaveAttribute('inert','');
  await nav.getByRole('button',{name:'Hoje',exact:true}).focus();
  await expect(dialog.getByRole('button',{name:'Fechar formulário'})).toBeFocused();
  await page.screenshot({path:'test-results/ux-editor-mobile.png',fullPage:false,animations:'disabled'});
  page.once('dialog',d=>d.accept());
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect(errors).toEqual([]);
  } finally {
    expect((await page.request.delete('/api/account',{data:{confirmation:'EXCLUIR'}})).ok()).toBeTruthy();
  }
});

test('installed app only caches its public offline fallback and never API responses', async ({page,context}) => {
  await page.goto('/');
  const manifest=await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  for(const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBeTruthy();
  await page.evaluate(async()=>{ await navigator.serviceWorker.ready; });
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBeTruthy();
  await page.request.get('/api/health');
  const urls=await page.evaluate(async()=>{ const cache=await caches.open('mentra-offline-v1'); return (await cache.keys()).map(request=>new URL(request.url).pathname); });
  expect(urls).toEqual(['/offline.html']);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading',{name:'Seu espaço espera por você.'})).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('link',{name:'Tentar novamente'}).click();
  await expect(page.getByLabel('E-mail',{exact:true})).toBeVisible();
});

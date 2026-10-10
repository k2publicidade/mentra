import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';

test('public site adapts, anchors and disclosures work, CTAs reach login and registration',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Imagine acordar assim.'})).toBeVisible();
  await expect(page.locator('.lp-hero-background img')).toHaveJSProperty('complete',true);
  expect(await page.locator('.lp-hero-background img').evaluate(node=>node.naturalWidth)).toBeGreaterThan(0);
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:950});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'test-results/landing-hero-desktop.png',animations:'disabled'});
  await page.locator('#recursos').scrollIntoViewIfNeeded();
  await expect(page.locator('.lp-feature').last()).toHaveClass(/is-visible/);
  await page.locator('#recursos').screenshot({path:'test-results/landing-features-desktop.png',animations:'disabled'});
  await page.getByRole('navigation',{name:'Navegação do site'}).getByRole('link',{name:'Planos',exact:true}).click();
  await expect(page.locator('#planos')).toBeInViewport();
  await expect(page.locator('.lp-price strong')).toHaveText('25');
  await expect(page.locator('.lp-plan-disclosure')).toContainText('cobrança ainda não disponíveis');
  const question=page.getByText('Como funciona o plano de R$25?',{exact:true});
  await question.click();await expect(page.locator('details[open]')).toContainText('não gera cobrança');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  expect(await page.locator('.lp-phone').evaluate(node=>getComputedStyle(node).animationName)).toBe('none');
  await page.screenshot({path:'test-results/landing-hero-mobile.png',animations:'disabled'});
  await page.locator('#planos').scrollIntoViewIfNeeded();
  await page.locator('#planos').screenshot({path:'test-results/landing-pricing-mobile.png',animations:'disabled'});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.getByRole('button',{name:'Abrir menu',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'Navegação do site'})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Abrir menu',exact:true})).toHaveAttribute('aria-expanded','false');
  await page.getByRole('link',{name:'Entrar',exact:true}).click();
  await expect(page).toHaveURL(/\/app$/);await expect(page.getByLabel('E-mail',{exact:true})).toBeVisible();
  await expect(page.getByLabel('Seu nome',{exact:true})).toHaveCount(0);
  await page.goto('/');await page.locator('.lp-hero-actions').getByRole('link',{name:'Criar meu espaço'}).click();
  await expect(page).toHaveURL(/\/app\?cadastro=1/);await expect(page.getByLabel('Seu nome',{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('landing registration CTA creates a real account and reaches the dashboard',async({page})=>{
  await page.goto('/');await page.locator('.lp-plan').getByRole('link',{name:'Criar minha conta'}).click();
  const password=crypto.randomBytes(20).toString('hex');
  await page.getByLabel('Seu nome',{exact:true}).fill('Teste Site');
  await page.getByLabel('E-mail',{exact:true}).fill(`landing-${crypto.randomUUID()}@example.com`);
  await page.getByLabel('Senha',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Criar meu espaço'}).click();
  try{
    await page.getByRole('button',{name:'Continuar',exact:true}).click();
    await page.getByRole('button',{name:'Começar sem registro',exact:true}).click();
    await expect(page.getByRole('navigation',{name:'Navegação principal'})).toBeVisible();
    await page.reload();await expect(page.getByRole('navigation',{name:'Navegação principal'})).toBeVisible();
  }finally{expect((await page.request.delete('/api/account',{data:{confirmation:'EXCLUIR'}})).ok()).toBeTruthy()}
});

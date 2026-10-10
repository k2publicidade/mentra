import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';

for(const reducedMotion of ['no-preference','reduce']) {
  test(`loading and navigation remain usable with motion ${reducedMotion}`,async({page})=>{
    await page.emulateMedia({reducedMotion});
    await page.setViewportSize({width:390,height:844});
    const result=await page.request.post('/api/auth/register',{data:{name:'Teste Motion',email:`motion-${crypto.randomUUID()}@example.com`,password:crypto.randomBytes(20).toString('hex'),timezone:'America/Sao_Paulo'}});
    expect(result.status()).toBe(201);
    let release;
    const pending=new Promise(resolve=>{release=resolve;});
    try {
      await page.request.patch('/api/profile',{data:{onboarded:true}});
      await page.route('**/api/items',async route=>{if(route.request().method()==='GET')await pending;await route.continue();});
      await page.goto('/app');
      await expect(page.getByText('Buscando seus registros…')).toBeVisible();
      const progress=page.getByRole('progressbar',{name:'Atualizando registros',exact:true});
      await expect(progress).toBeVisible();
      await expect(progress).not.toHaveAttribute('aria-valuenow');
      await expect(page.locator('.loading-skeleton')).toBeVisible();
      if(reducedMotion==='reduce') {
        expect(await progress.locator('span').evaluate(node=>getComputedStyle(node).animationName)).toBe('none');
        expect(await page.locator('.loading-skeleton > span').first().evaluate(node=>getComputedStyle(node,'::after').display)).toBe('none');
      }
      release();
      await expect(page.getByRole('heading',{name:'Seu dia, com espaço.'})).toBeVisible();
      await expect(progress).toHaveCount(0);
      const nav=page.getByRole('navigation',{name:'Navegação principal'});
      // Rapid changes must not queue delayed routing or resurrect an old screen.
      await nav.getByRole('button',{name:'Vida',exact:true}).click();
      await nav.getByRole('button',{name:'Mentra',exact:true}).click();
      await nav.getByRole('button',{name:'Eu',exact:true}).click();
      await expect(page.getByRole('heading',{name:'Do seu jeito.'})).toBeVisible();
      await expect(nav.getByRole('button',{name:'Eu',exact:true})).toHaveAttribute('aria-current','page');
      if(reducedMotion==='reduce') {
        expect(await page.locator('.screen-stage').evaluate(node=>getComputedStyle(node).animationName)).toBe('none');
        expect(await nav.getByRole('button',{name:'Eu',exact:true}).evaluate(node=>getComputedStyle(node).transitionProperty)).toBe('none');
      }
      await nav.getByRole('button',{name:'Mentra',exact:true}).click();
      const input=page.getByLabel('Mensagem para a Mentra');
      await input.fill('Rascunho disponível durante a navegação');
      const box=await input.boundingBox();
      expect(box.y+box.height).toBeLessThan(844-72);
      await nav.getByRole('button',{name:'Vida',exact:true}).click();
      await page.getByRole('button',{name:'Adicionar registro',exact:true}).click();
      const dialog=page.getByRole('dialog');
      await expect(dialog.getByLabel('Título',{exact:true})).toBeFocused();
      if(reducedMotion==='reduce') expect(await dialog.evaluate(node=>getComputedStyle(node).animationName)).toBe('none');
      await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
      await expect(dialog).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    } finally {
      release();
      await page.request.delete('/api/account',{data:{confirmation:'EXCLUIR'}});
    }
  });
}

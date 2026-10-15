/** Additional real-state interactions, using only IDs created by workflows.mjs. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const records=JSON.parse(await readFile('.artifacts/workflows/results.json','utf8'));
const base='http://127.0.0.1:55052',apiBase='http://127.0.0.1:55053';
const api=async(path,body,method=body?'POST':'GET')=>{const r=await fetch(apiBase+'/api'+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});assert.ok(r.ok,`${path}: ${r.status}`);const t=await r.text();return t?JSON.parse(t):null;};
const browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await context.route(u=>u.pathname.startsWith('/api/'),async r=>{const response=await r.fetch({url:apiBase+new URL(r.request().url()).pathname+new URL(r.request().url()).search});await r.fulfill({response});});
const page=await context.newPage();page.setDefaultTimeout(20000);
const results=[];
try{
for(const record of records){
 const {id,klass,edition}=record;const character=await api(`/characters/${id}`);assert.ok(character.character.name.startsWith('Codex '));
 await page.goto(`${base}/battle/${id}`);await page.getByRole('heading',{name:new RegExp(character.character.name,'i')}).waitFor();
 const dash=page.getByRole('listitem').filter({has:page.getByText('Dash',{exact:true})}).getByRole('button',{name:'Use',exact:true});
 await dash.click();await page.getByRole('button',{name:'Action: used',exact:true}).waitFor();
 assert.ok(await dash.isDisabled(),'Used action unavailable');
 await page.reload();await page.getByRole('button',{name:'Action: used',exact:true}).waitFor();
 await page.getByRole('button',{name:'Next turn',exact:true}).first().click();await page.getByRole('button',{name:'Action: ready',exact:true}).waitFor();
 if(klass==='Fighter'){
  await page.getByRole('tab',{name:/^Bonus action/}).click();
  const secondWind=page.getByRole('listitem').filter({has:page.getByText('Second Wind',{exact:true})});
  await secondWind.getByRole('button',{name:'Use',exact:true}).click();await page.waitForTimeout(500);
  assert.equal((await api(`/characters/${id}/combat`)).uses['Second Wind'],1,'Resource spent');
  await page.getByRole('button',{name:'Short rest',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Rest',exact:true}).click();
  await page.waitForTimeout(500);assert.equal((await api(`/characters/${id}/combat`)).uses['Second Wind']??0,0,'Short rest restored resource');
 }
 if(klass==='Wizard'){
  const cast=page.getByRole('button',{name:'Cast',exact:true}).first();
  await cast.click();await page.getByRole('button',{name:'Action: used',exact:true}).waitFor();
  await page.getByRole('button',{name:'Next turn',exact:true}).first().click();
  const magic=await api(`/characters/${id}/magic`);await api(`/characters/${id}/magic`,{...magic,expendedSlots:{}},'PUT');
  await page.goto(`${base}/characters/${id}/play`);await page.getByRole('link',{name:'Spellcasting',exact:true}).click();
  const slots=page.getByRole('group',{name:'1st level slots',exact:true});
  await slots.getByRole('button').first().click();await page.waitForTimeout(500);
  assert.equal((await api(`/characters/${id}/magic`)).expendedSlots['1'],1,'Shared slot saved');
  const prepare=page.getByRole('button',{name:'Prepare',exact:true}).first();await prepare.click();
  await page.getByRole('button',{name:'Unprepare',exact:true}).first().waitFor();
  await page.waitForTimeout(500);const prepared=await api(`/characters/${id}/magic`);
  assert.ok(Object.values(prepared.prepared).some(ids=>ids.length>0),'Preparation saved');
  await page.getByRole('button',{name:'Unprepare',exact:true}).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button',{name:'Long rest',exact:true}).click();await page.getByRole('button',{name:'Take the long rest',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('fieldset')?.disabled);
  assert.equal((await api(`/characters/${id}/magic`)).expendedSlots['1']??0,0,'Rest restores slots');
 }
 await page.goto(`${base}/characters/${id}/sheet`);await page.getByRole('button',{name:'Download PDF'}).waitFor();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF'}).click();const download=await downloadPromise;
 await download.saveAs(`.artifacts/workflows/${klass}-${edition}.pdf`);
 const bytes=await readFile(`.artifacts/workflows/${klass}-${edition}.pdf`);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
 await page.locator('img[src^="blob:"]').first().waitFor();await page.screenshot({path:`.artifacts/workflows/${klass}-${edition}-pdf.png`,fullPage:true});
 results.push({klass,edition,battleDash:true,nextTurn:true,pdfDownload:true,pdfRendered:true,spellCast:klass==='Wizard',preparation:klass==='Wizard',slotsRestored:klass==='Wizard',secondWind:klass==='Fighter'});console.log('PASS play/PDF',klass,edition);
}
await writeFile('.artifacts/workflows/play-results.json',JSON.stringify(results,null,2));
}catch(e){console.error((await page.locator('body').innerText()).slice(0,3000));await page.screenshot({path:'.artifacts/workflows/play-failure.png',fullPage:true});throw e;}
finally{await context.unrouteAll({behavior:'wait'});await browser.close();}

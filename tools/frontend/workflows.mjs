/** Real API checks: run ONLY against the disposable starlights-codex-api database. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const apiBase='http://127.0.0.1:55053';
const frontend='http://127.0.0.1:55052';
const output='.artifacts/workflows';await mkdir(output,{recursive:true});
const api=async(path,body,method=body?'POST':'GET')=>{const r=await fetch(apiBase+'/api'+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const text=await r.text();assert.ok(r.ok,`${method} ${path}: ${r.status} ${text.slice(0,300)}`);return text?JSON.parse(text):null;};
const players=await api('/characters/players');assert.ok(players.players.every(p=>p.name.startsWith('Codex Synthetic')), 'Refuse non-synthetic database');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});
await context.addInitScript(()=>{localStorage.setItem('starlights.player','Codex Synthetic');localStorage.setItem('starlights-ui-theme','porcelain')});
await context.route(u=>u.pathname.startsWith('/api/'),async route=>{const r=await route.fetch({url:apiBase+new URL(route.request().url()).pathname+new URL(route.request().url()).search});await route.fulfill({response:r});});
const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function settled(id){for(let n=0;n<100;n++){const c=await api(`/characters/${id}/builder/choices`);if(!c.pending&&c.choices.length)return c.choices;await new Promise(r=>setTimeout(r,300));}throw Error('Builder processing did not settle');}
async function select(id,choice,name,edition){const {options}=await api(`/characters/${id}/builder/selection-rules/${choice.ruleId}/options`);const eligible=options.filter(o=>o.eligible!==false);const o=eligible.find(o=>o.name===name&&(!edition||(o.source?.includes('2024')??false)===(edition==='2024')))||eligible.find(o=>o.name===name);assert.ok(o,`Missing ${name} choice`);await api(`/characters/${id}/builder/selection-rules/${choice.ruleId}/register`,{parentRegistration:choice.registrationId,elementId:o.elementId});return settled(id);}
const results=[];
try {
 for(const [klass,edition] of [['Fighter','2014'],['Wizard','2024'],['Wizard','2014']]){
  const name=`Codex ${klass} ${edition} ${Date.now()}`;
  console.log('Creating',klass,edition);await page.goto(frontend+'/characters/create',{waitUntil:'domcontentloaded'});await page.getByLabel('Name',{exact:true}).fill(name);
  await page.getByRole('radio',{name:new RegExp('^'+edition+' rules')}).click();
  await page.getByRole('button',{name:'Create Character',exact:true}).click();
  await page.waitForURL(/\/characters\/[0-9a-f-]{36}(?:\?|$)/);const id=new URL(page.url()).pathname.split('/')[2];
  let choices=await settled(id);choices=await select(id,choices.find(c=>c.type==='Class'),klass,edition);
  // Scores enable legitimate multiclass prerequisites; preserve normal API validation.
  for(const a of (await api(`/characters/${id}/ability-scores`)).abilityScores)await api(`/characters/${id}/ability-scores/${a.abilityScoreId}/base`,{value:14});
  if(klass==='Wizard'){
   const primary=(await api(`/characters/${id}/classes`)).classes[0];
   await api(`/characters/${id}/classes/${primary.characterClassId}/level`,{newLevel:3});choices=await settled(id);
   const spell=choices.find(c=>c.type==='Spell'&&!c.selected);
   assert.ok(spell,'Wizard spell choices');
   await page.goto(`${frontend}/characters/${id}`);
   await page.getByRole('tab',{name:/^Magic/}).click();
   const picker=page.locator('section.spell-browser').first();await picker.getByRole('button',{name:'Choose spell',exact:true}).click();
   const learn=picker.getByRole('button',{name:'Learn',exact:true}).first();
   await learn.click();await picker.getByRole('button',{name:'Remove',exact:true}).waitFor();
   await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByText('No unsaved changes.',{exact:true}).waitFor();
   await page.screenshot({path:`${output}/wizard-${edition}-magic.png`,fullPage:true});
   assert.ok((await settled(id)).some(c=>c.type==='Spell'&&c.selected),'Spell persisted');
   const mc=await api(`/characters/${id}/multiclass`);const cleric=mc.options.find(o=>o.name.includes('Cleric')&&o.eligible&&(o.source.includes('2024')===(edition==='2024')));
   assert.ok(cleric,'Eligible Cleric multiclass');await api(`/characters/${id}/multiclass`,{elementId:cleric.elementId});await settled(id);
   const casters=(await api(`/characters/${id}/spellcasting`)).casters;assert.ok(casters.length>=2,'Multiclass casting contexts retained');
  }
  await api(`/characters/${id}/builder/session/save`,{});
  await page.goto(`${frontend}/characters/${id}/play`);await page.getByRole('heading',{name:new RegExp(name,'i')}).waitFor();
  await page.getByRole('textbox',{name:'Amount',exact:true}).fill('3');await page.getByRole('button',{name:'Damage',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('fieldset')?.disabled);
  assert.equal((await api(`/characters/${id}/combat`)).damage,3);
  await page.getByRole('textbox',{name:'Amount',exact:true}).fill('5');await page.getByRole('button',{name:'Temp HP',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('fieldset')?.disabled);
  await page.reload();await page.getByRole('heading',{name:new RegExp(name,'i')}).waitFor();
  assert.equal((await api(`/characters/${id}/combat`)).temporaryHitPoints,5);
  await page.getByRole('button',{name:'Short rest',exact:true}).click();await page.getByRole('button',{name:'One die more'}).click();await page.getByRole('button',{name:/^Rest \(average/}).click();
  await page.waitForFunction(()=>!document.querySelector('fieldset')?.disabled);
  assert.equal((await api(`/characters/${id}/combat`)).hitDiceSpent,1);
  await page.getByRole('button',{name:'Long rest',exact:true}).click();await page.getByRole('button',{name:'Take the long rest',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('fieldset')?.disabled);
  assert.equal((await api(`/characters/${id}/combat`)).damage,0);
  await page.screenshot({path:`${output}/${klass}-${edition}-sheet.png`,fullPage:true});
  await page.goto(`${frontend}/battle/${id}`);await page.getByRole('heading',{name:new RegExp(name,'i')}).waitFor();
  await page.screenshot({path:`${output}/${klass}-${edition}-battle.png`,fullPage:true});
  results.push({id,klass,edition,createdInBrowser:true,levelled:klass==='Wizard',multiclass:klass==='Wizard',hp:true,rests:true});
  await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));console.log('PASS',klass,edition);
 }
 assert.deepEqual(errors,[]);
} catch(e){console.error((await page.locator('body').innerText()).slice(0,1800));await page.screenshot({path:`${output}/failure.png`,fullPage:true});throw e;}
finally{await context.unrouteAll({behavior:"wait"});await browser.close();}

/** Complete eligible required selections in the disposable workflow characters only. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const records=JSON.parse(await readFile('.artifacts/workflows/results.json','utf8'));
const api=async(p,b)=>{const r=await fetch('http://127.0.0.1:55053/api'+p,{method:b?'POST':'GET',headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});if(!r.ok)throw Error(p+' '+r.status+' '+await r.text());const t=await r.text();return t?JSON.parse(t):null;};
const summary=[];
for(const {id,klass,edition} of records){
 assert.ok((await api(`/characters/${id}`)).character.name.startsWith('Codex '), 'Only synthetic test characters');
 const skipped=new Set();let picks=0;
 for(let n=0;n<120;n++){
  const state=await api(`/characters/${id}/builder/choices`);if(state.pending){await new Promise(r=>setTimeout(r,400));continue;}
  const c=state.choices.find(c=>!c.optional&&!c.selected&&!skipped.has(c.ruleId));if(!c)break;
  const opts=(await api(`/characters/${id}/builder/selection-rules/${c.ruleId}/options`)).options;
  const learned=new Set(state.choices.filter(x=>x.registrationId===c.registrationId&&x.type===c.type&&x.selected).map(x=>x.selected.name));
  const available=opts.filter(o=>o.eligible!==false&&!learned.has(o.name));
  const option=available.find(o=>(o.source?.includes('2024')??false)===(edition==='2024'))??available[0];
  if(!option){skipped.add(c.ruleId);continue;}
  await api(`/characters/${id}/builder/selection-rules/${c.ruleId}/register`,{parentRegistration:c.registrationId,elementId:option.elementId});picks++;
 }
 await api(`/characters/${id}/builder/session/save`,{});
 const remaining=(await api(`/characters/${id}/builder/choices`)).choices.filter(c=>!c.optional&&!c.selected).map(c=>({name:c.name,type:c.type}));
 summary.push({id,klass,edition,picks,remaining});console.log(klass,edition,picks,JSON.stringify(remaining));
}
await writeFile('.artifacts/workflows/completion.json',JSON.stringify(summary,null,2));

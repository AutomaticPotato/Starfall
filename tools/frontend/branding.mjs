/** Deterministic crops of the owner's artwork. No redraw or background removal. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const source = process.argv[2];
if (!source) throw new Error('Provide the original logo path');
const original = await readFile(source);
const output = 'src/frontend/apps/builder-app/public/branding';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
 const page = await browser.newPage();
 const variants = await page.evaluate(async (data) => {
  const img = new Image(); img.src = data; await img.decode();
  const result = {};
  for (const [name, size, crop, type] of [
   ['starlights-logo.webp', [1000,750], [0,0,1448,1086], 'image/webp'],
   ['starlights-emblem.webp',[256,256],[414,64,620,620],'image/webp'],
   ['apple-touch-icon.png',[180,180],[414,64,620,620],'image/png'],
   ...[16,32,48].map(n=>[`favicon-${n}.png`,[n,n],[570,230,310,310],'image/png'])
  ]) {
   const canvas = document.createElement('canvas'); [canvas.width,canvas.height] = size;
   const ctx = canvas.getContext('2d'); ctx.fillStyle='#0b1424'; ctx.fillRect(0,0,...size);
   ctx.imageSmoothingQuality='high'; ctx.drawImage(img,...crop,0,0,...size);
   result[name]=canvas.toDataURL(type,0.92).split(',')[1];
  }
  return result;
 }, `data:image/png;base64,${original.toString('base64')}`);
 for(const [name,data] of Object.entries(variants)) await writeFile(`${output}/${name}`,Buffer.from(data,'base64'));
 const frames = [16,32,48].map(n=>({n,data:Buffer.from(variants[`favicon-${n}.png`],'base64')}));
 const header=Buffer.alloc(6+16*frames.length); header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);
 let offset=header.length;
 frames.forEach(({n,data},i)=>{const p=6+i*16;header[p]=n;header[p+1]=n;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(data.length,p+8);header.writeUInt32LE(offset,p+12);offset+=data.length;});
 await writeFile(`${output}/favicon.ico`,Buffer.concat([header,...frames.map(f=>f.data)]));
 console.log('Original SHA256:',createHash('sha256').update(original).digest('hex'));
} finally {await browser.close();}

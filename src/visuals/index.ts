import {writeFile} from 'node:fs/promises';
import type {ImageProvider} from '../providers/interfaces';
const escape=(s:string)=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
export class OriginalCards implements ImageProvider {
 constructor(private colors={background:"#10243a",accent:"#62e5ca"}){}
 async generate(prompt:string,path:string){const lines=prompt.match(/.{1,36}(?:\s|$)/g)??[prompt.slice(0,36)];await writeFile(path,`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="${this.colors.background}"/><circle cx="1100" cy="100" r="180" fill="#17445a"/><rect x="90" y="150" width="12" height="250" fill="${this.colors.accent}"/>${lines.slice(0,4).map((l,i)=>`<text x="140" y="${240+i*70}" font-family="sans-serif" font-size="54" fill="white">${escape(l.trim())}</text>`).join('')}</svg>`);}
}

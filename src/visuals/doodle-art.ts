import art from '../../config/style-lock-v3.json';
import type {VisualIdea} from './thinking-schema';
export const doodlePalette=Object.freeze({paper:art.colorPalette[0],sand:art.colorPalette[1],terracotta:art.colorPalette[2],ochre:art.colorPalette[3],brown:art.colorPalette[4],red:art.colorPalette[5],green:art.colorPalette[6],ink:art.colorPalette[7]});
const xml=(s:string)=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
function labelLines(label:string,limit:number){const words=label.split(/\s+/),lines:string[]=[''];for(const word of words){if(lines.at(-1)!.length+word.length+1>limit&&lines.at(-1))lines.push(word);else lines[lines.length-1]+=(lines.at(-1)?' ':'')+word;}return lines;}
const path=(d:string,fill='none')=>`<path d="${d}" fill="${fill}"/>`;
export function doodleGlyph(icon:VisualIdea['nodes'][number]['icon'],pose='neutral'){
 const p=doodlePalette;
 switch(icon){
  case 'person':case 'child':{const arms=pose==='point'?'M-24 -4 L-50 10 M24 -4 L68 -36':pose==='carry'?'M-24 -4 L-45 30 L-12 30 M24 -4 L45 30 L12 30':pose==='think'?'M-24 -4 L-45 12 M24 -4 L47 -18 L22 -46':'M-24 -4 L-45 24 M24 -4 L45 24';return `<g transform="scale(${icon==='child'?.8:1})"><circle cx="0" cy="-66" r="27" fill="${p.sand}"/>${path('M-26 -68 Q-22 -100 10 -92 L26 -72',p.ink)}<circle cx="-9" cy="-65" r="2" fill="${p.ink}"/><circle cx="9" cy="-65" r="2" fill="${p.ink}"/>${path('M-8 -51 Q0 -46 8 -51')}${path('M-20 -34 L20 -34 L32 53 L-32 53 Z',p.terracotta)}${path(arms)}${path(pose==='walk'?'M-15 54 L-36 88 M15 54 L40 70 L32 90':'M-15 54 L-15 90 M15 54 L15 90')}<path d="M-26 91 L-6 91 M6 91 L27 91"/></g>`;}
  case 'amphora':return path('M-15 -77 L15 -77 L12 -48 Q53 -31 34 30 L15 74 L-15 74 L-34 30 Q-53 -31 -12 -48 Z',p.terracotta)+path('M-19 -46 Q-67 -61 -46 -7 L-34 8 M19 -46 Q67 -61 46 -7 L34 8')+path('M-16 -76 L16 -76');
  case 'boat':return path('M-88 24 L88 24 L62 69 L-60 69 Z',p.brown)+path('M-3 24 L-3 -84 M6 -80 L67 9 L6 9 Z',p.sand)+path('M-101 85 Q-79 71 -58 85 Q-35 99 -10 85 Q12 71 35 85 Q58 99 99 85');
  case 'coin':return `<circle r="63" fill="${p.ochre}"/><circle r="46" fill="none"/><circle cx="-4" cy="-10" r="15" fill="${p.sand}"/>${path('M-26 27 Q-25 4 -4 4 Q17 4 18 27',p.sand)}`;
  case 'scroll':case 'book':return path('M-53 -67 L44 -67 Q68 -67 68 -44 L54 -44 L54 61 L-53 61 Q-75 61 -75 41 L-53 41 Z',p.sand)+path('M-27 -34 L31 -34 M-27 -10 L31 -10 M-27 14 L16 14');
  case 'tool':return path('M-52 79 L31 -58',p.ochre)+path('M-29 -65 Q27 -90 67 -34 L46 -17 Q13 -49 -29 -45 Z',p.brown);
  case 'sun':return `<circle r="36" fill="${p.ochre}"/>${[0,45,90,135,180,225,270,315].map(deg=>`<path transform="rotate(${deg})" d="M0 -54 L0 -78"/>`).join('')}`;
  case 'warning':return path('M0 -78 L88 70 L-88 70 Z',p.ochre)+path('M0 -28 L0 22')+`<circle cx="0" cy="44" r="4" fill="${p.ink}"/>`;
  case 'building':return path('M-88 -34 L0 -78 L88 -34 Z',p.sand)+path('M-78 72 L78 72 M-58 -28 L-58 63 M-20 -28 L-20 63 M20 -28 L20 63 M58 -28 L58 63');
  case 'clock':return `<ellipse cx="0" cy="35" rx="85" ry="37" fill="${p.sand}"/>${path('M-35 35 L15 -45 L15 35 Z',p.brown)}${path('M15 35 L55 52')}<circle cx="50" cy="-65" r="20" fill="${p.ochre}"/>`;
  case 'path':return path('M-70 76 Q80 56 5 5 Q-75 -46 65 -76')+path('M36 -78 L69 -78 L65 -47');
  case 'focus':return `<circle r="65" fill="${p.sand}"/><circle r="38" fill="none"/><circle r="11" fill="${p.terracotta}"/>${path('M76 -76 L8 -8 M45 -76 L76 -76 L76 -44')}`;
  case 'balance':return path('M0 -75 L0 75 M-48 75 L48 75 M-67 -30 L67 -30 M-55 -30 L-80 20 L-30 20 Z M55 -30 L30 20 L80 20 Z',p.sand);
  case 'arrow':return path('M-75 0 L75 0 M34 -40 L75 0 L34 40');
 }
}
export function doodleLayout(idea:VisualIdea){
 const vertical=idea.conceptType==='HIERARCHY';
 return idea.nodes.map((node,i)=>({node,x:vertical?850:idea.nodes.length===1?960:360+i*1200/(idea.nodes.length-1),y:vertical?195+i*180:idea.conceptType==='MAP'?350+(i%2)*180:470,scale:vertical?.64:idea.nodes.length>3?1:1.4}));
}
export function doodleSVG(idea:VisualIdea,progress=1){
 const p=doodlePalette,layout=doodleLayout(idea);const clamp=(n:number)=>Math.max(0,Math.min(1,n));
 const elements=layout.map(({node,x,y,scale},i)=>{const reveal=i===0?1:clamp((progress-i*.14)*5);const lines=labelLines(node.label,layout.length>=3?14:24),hierarchy=idea.conceptType==='HIERARCHY',base=hierarchy?15:185;return `<g opacity="${reveal}" transform="translate(${x} ${y+12*(1-reveal)})"><ellipse cx="0" cy="${105*scale}" rx="${75*scale}" ry="8" fill="${p.sand}" stroke="none"/><g transform="scale(${scale})" stroke="${p.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${doodleGlyph(node.icon,node.pose)}</g><text x="${hierarchy?145:0}" y="${base}" text-anchor="${hierarchy?'start':'middle'}" font-family="Arial,sans-serif" font-size="46" font-weight="700" fill="${p.ink}">${lines.map((line,j)=>`<tspan x="${hierarchy?145:0}" dy="${j?52:0}">${xml(line)}</tspan>`).join('')}</text>${node.emphasis?`<path d="M-65 ${hierarchy?100:base+22+(lines.length-1)*52} Q0 ${hierarchy?106:base+28+(lines.length-1)*52} 65 ${hierarchy?99:base+21+(lines.length-1)*52}" stroke="${p.terracotta}" stroke-width="8" fill="none" stroke-linecap="round"/>`:''}</g>`;});
 const edges=idea.relationships.map((r,i)=>{const a=layout.find(n=>n.node.id===r.from)!,b=layout.find(n=>n.node.id===r.to)!;const vertical=idea.conceptType==='HIERARCHY',directionX=Math.sign(b.x-a.x),directionY=Math.sign(b.y-a.y);const x1=a.x+(vertical?0:150*directionX),y1=a.y+(vertical?75*directionY:0),x2=b.x-(vertical?0:150*directionX),y2=b.y-(vertical?75*directionY:0);const reveal=clamp((progress-.18-i*.14)*5);return `<g opacity="${reveal}"><path d="M${x1} ${y1} L${x2} ${y2}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${1-reveal}" fill="none" stroke="${p.brown}" stroke-width="7" marker-end="url(#tip)"/><text x="${(x1+x2)/2-(vertical?180:0)}" y="${(y1+y2)/2+(vertical?10:-145)}" text-anchor="middle" fill="${p.ink}" font-family="Arial,sans-serif" font-size="32">${xml(r.label)}</text></g>`;});
 const backdrop=idea.conceptType==='COMPARE_TWO'?`<rect x="160" y="180" width="600" height="590" rx="32" fill="${p.sand}" opacity=".35"/><rect x="1160" y="180" width="600" height="590" rx="32" fill="${p.sand}" opacity=".65"/>`:idea.conceptType==='TIMELINE'?`<path d="M200 745 L1710 745" stroke="${p.brown}" stroke-width="5" fill="none"/>${layout.map(n=>`<circle cx="${n.x}" cy="745" r="9" fill="${p.terracotta}"/>`).join('')}`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><defs><marker id="tip" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0 0 L4 2 L0 4" fill="${p.brown}"/></marker></defs><rect width="1920" height="1080" fill="${p.paper}"/><path d="M110 120 Q460 110 700 122" fill="none" stroke="${p.sand}" stroke-width="4"/>${backdrop}${edges.join('')}${elements.join('')}</svg>`;
}

import {parseArgs} from 'node:util';
import {mkdir,readdir,copyFile} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {voice} from '../src/orchestration/schemas';
import {milestoneScript} from '../src/visuals/quality-script';
import {read,json} from '../src/orchestration/io';
import {digest,fileDigest} from '../src/orchestration/integrity';
const {values}=parseArgs({options:{source:{type:'string'},target:{type:'string'}}});
if(!values.source||!values.target||!/^[A-Za-z0-9_-]+$/.test(values.target))throw new Error('Source artifact folder and safe target run ID required');
const dir=join('data/runs',values.target),source=values.source;
await mkdir(join(dir,'assets'),{recursive:true});
const script=milestoneScript.parse(await read(join(source,'approved-script.json'))),old=voice.parse(await read(join(source,'voice.json')));
const files=await readdir(join(source,'assets'));
for(const scene of old.scenes){const name=basename(scene.path);for(const file of files.filter(f=>f===name||f.startsWith(name+'.'))){await copyFile(join(source,'assets',file),join(dir,'assets',file));}if(await fileDigest(join(source,'assets',name))!==await fileDigest(join(dir,'assets',name)))throw new Error('Narration copy integrity failure');}
const rewrite=(value:unknown):unknown=>typeof value==='string'&&value.startsWith('data/runs/')&&value.includes('/assets/')?join(dir,'assets',basename(value)):Array.isArray(value)?value.map(rewrite):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v)])):value;
const restored=voice.parse(rewrite(old));
await json(join(dir,'voice.json'),restored);await json(join(dir,'voice.integrity.json'),{sha256:digest(restored)});
await json(join(dir,'milestone-script.json'),script);await json(join(dir,'milestone-script.integrity.json'),{sha256:digest(script)});await json(join(dir,'approved-script.json'),script);
await json(join(dir,'narration-provenance.json'),{sourceArtifact:source,method:'Only approved script, raw WAV and voice evidence copied; NO old images, identity packs, prompts, composition or render checkpoints',referenceSha256:await fileDigest('assets/voice/narrator-reference.wav'),autoPublish:false});

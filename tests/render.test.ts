import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserOptions,withBrowser} from '../src/render/browser';
import {superviseWorker} from '../src/render/supervisor';
test('full CI Chrome uses modern headless; downloaded shell retains its matching mode',()=>{assert.equal(browserOptions('/usr/bin/google-chrome').chromeMode,'chrome-for-testing');assert.equal(browserOptions().chromeMode,'headless-shell');assert.equal(browserOptions().chromiumOptions.headless,true);});
test('browser closes on successful render and on render rejection',async()=>{for(const fail of [false,true]){let closes=0;const run=withBrowser(async()=>({close:async()=>{closes++;}}),async()=>{if(fail)throw new Error('render failed');});if(fail)await assert.rejects(run,/render failed/);else await run;assert.equal(closes,1);}});
test('failed browser startup propagates without attempting to use a missing browser',async()=>{let rendered=false;await assert.rejects(withBrowser(async()=>{throw new Error('browser launch timed out');},async()=>{rendered=true;}),/browser launch timed out/);assert.equal(rendered,false);});
for(const mode of ['success','failure','timeout'])test(`render supervisor cleans detached descendants and leaked handles on ${mode}`,{skip:process.platform!=='linux',timeout:10000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'render-supervisor-'));const pidFile=join(dir,'pid');
 try{
  const started=Date.now();const run=superviseWorker(fileURLToPath(new URL('./fixtures/render-worker.mjs',import.meta.url)),{mode,pidFile},2000);
  if(mode==='success')await run;else await assert.rejects(run,mode==='timeout'?/deadline/:/connect to the browser/);
  assert.ok(Date.now()-started<5000,'A failure must not hold the job open');
  const pid=Number(await readFile(pidFile,'utf8'));
  try{const stat=await readFile(`/proc/${pid}/stat`,'utf8');assert.equal(stat.slice(stat.lastIndexOf(')')+2).split(' ')[0],'Z','Descendant must not remain running');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 }finally{await rm(dir,{recursive:true});}
});

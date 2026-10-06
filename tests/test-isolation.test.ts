import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {exec} from '../src/orchestration/io';
test('preloaded test process cannot receive production keys or overwrite the workflow quota ledger',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'test-env-'));const ledger=join(dir,'production-ledger.json');const original=JSON.stringify({events:[],runtimeSeconds:999});await writeFile(ledger,original);
 try{await exec(process.execPath,['--import','tsx','--import',resolve('scripts/test-isolation.mjs'),'--input-type=module','-e',`import {FreeQuotaLedger} from ${JSON.stringify(pathToFileURL(resolve('src/quota/index.ts')).href)}; if(process.env.GEMINI_API_KEY||process.env.CLOUDFLARE_API_TOKEN||process.env.FREE_QUOTA_LEDGER_PATH)throw new Error('Test environment leaked'); const q=new FreeQuotaLedger(process.env.YT_TEST_ISOLATED_DIR); await q.reserve('gemini','fixture'); await q.report();`],{env:{...process.env,GEMINI_API_KEY:'simulated-production-key',CLOUDFLARE_API_TOKEN:'simulated-production-token',FREE_QUOTA_LEDGER_PATH:ledger,YT_TEST_ISOLATED_DIR:join(dir,'unit')},timeout:30000});
 assert.equal(await readFile(ledger,'utf8'),original);assert.ok(JSON.parse(await readFile(join(dir,'unit','free-quota-ledger.json'),'utf8')).events.length===1);
 }finally{await rm(dir,{recursive:true});}
});

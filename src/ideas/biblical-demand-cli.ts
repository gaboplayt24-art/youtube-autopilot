import {FreeQuotaLedger,withQuota} from '../quota';
import {researchBiblicalDemand} from './biblical-demand';
import {json} from '../orchestration/io';
const dir='data/research/biblical-demand',quota=new FreeQuotaLedger(dir);
(async()=>{await quota.restore();try{await withQuota(quota,async()=>{const report=await researchBiblicalDemand();await json(dir+'/demand-report.json',report);console.log(JSON.stringify({topics:report.topics.map(t=>({topic:t.topic,sampleSize:t.sampleSize,medianViewsPerDay:t.medianViewsPerDay})),searchVolume:null,paidApiCostUsd:0}));});}finally{await quota.report();}})().catch(()=>{console.error('Biblical demand research failed; inspect workflow and preserved quota evidence. No credentials are printed.');process.exitCode=1;});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {visualPreflight,assetCorrections,correctAssetPlan} from '../src/visuals/preflight';
test('historical label repairs preserve unchanged assets and reject unknown correction IDs',async()=>{
 const original=visualPreflight.parse({historicalReview:{passed:true,issues:[]},assets:Array.from({length:12},(_,i)=>({id:`scene-${Math.floor(i/3)+1}-detail-${i%3+1}`,sceneId:`scene-${Math.floor(i/3)+1}`,prompt:'Period-correct original object study',character:false})),thumbnailTexts:['Harbor at dawn','A merchant waits','The trade record']});
 const changes=assetCorrections.parse(JSON.parse(await readFile('config/quality-asset-corrections.json','utf8')));
 const repaired=correctAssetPlan(original,changes);
 assert.equal(repaired.assets.filter((a,i)=>a.prompt!==original.assets[i].prompt).length,2);
 assert.match(repaired.assets[0].prompt,/uninscribed/);
 assert.match(repaired.assets[10].prompt,/No paper labels/);
 assert.deepEqual(repaired.assets.map(a=>a.id),original.assets.map(a=>a.id));
 assert.equal(original.assets[0].prompt,'Period-correct original object study');
 assert.throws(()=>correctAssetPlan(original,{'missing-asset':'Plain unmarked pottery'}),/unknown asset/);
});

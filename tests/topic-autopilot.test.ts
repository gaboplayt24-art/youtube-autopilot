import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {topicCatalog,rankTopics,usedTopicIds,nextRunId,episodeFiles,rollQueue,needsTopics} from '../src/ideas/topic-autopilot';
import {monthlyProduction} from '../src/orchestration/monthly-production';
import {editorialDraftSchema} from '../src/script';

const catalog=async()=>topicCatalog.parse(JSON.parse(await readFile('config/topic-catalog.json','utf8')));
test('the catalog is valid, unique and every brief is a valid editorial draft',async()=>{
 const c=await catalog();assert.equal(new Set(c.topics.map(t=>t.id)).size,c.topics.length);
 for(const t of c.topics){const {draft,titles}=episodeFiles(t,'bible-'+t.id+'-007');editorialDraftSchema.parse(draft);assert.equal(draft.chapters.length,5);assert.deepEqual(Object.keys(titles.titles),['chapter-2','chapter-3','chapter-4']);assert.ok(draft.sourceUrls.every(u=>u.startsWith('https://www.biblegateway.com/passage/?search=')));}
});
test('ranking uses measured demand across channels, skips used topics and boosts the season',async()=>{
 const t=(await catalog()).topics,now=new Date('2026-11-20T00:00:00Z');
 const demand=[{topic:'babel',distinctChannels:12,medianViewsPerDay:1000},{topic:'nativity',distinctChannels:12,medianViewsPerDay:800},{topic:'goliath',distinctChannels:2,medianViewsPerDay:2000},{topic:'eden',distinctChannels:9,medianViewsPerDay:null}];
 const ranked=rankTopics(t,demand,new Set(['babel']),now);
 assert.deepEqual(ranked.map(r=>r.topic.id),['nativity','goliath']);assert.equal(ranked[0].score,1200);
});
test('used ids and run numbers come from the drafts on disk',()=>{
 const files=['bible-noah-003-editorial-draft.json','bible-daniel-006-editorial-draft.json','bible-daniel-006-chapter-titles.json','bible-angels-001-editorial-draft.json'];
 assert.deepEqual([...usedTopicIds(files)].sort(),['angels','daniel','noah']);assert.equal(nextRunId(files,'babel'),'bible-babel-007');
});
test('the rolling queue drops delivered episodes, keeps pending ones and adds topics a week apart inside the limits',async()=>{
 const c=monthlyProduction.parse(JSON.parse(await readFile('config/monthly-production.json','utf8')));
 const now=new Date('2026-11-05T12:00:00Z');
 const runs=[{id:1,display_title:'production-bible-noah-003',conclusion:'success',created_at:'2026-10-23T03:12:45Z',updated_at:'2026-10-23T04:50:00Z',status:'completed'},{id:2,display_title:'production-bible-jonah-004',conclusion:'success',created_at:'2026-11-04T03:00:00Z',updated_at:'2026-11-04T05:00:00Z',status:'completed'}];
 assert.equal(needsTopics(c,runs),false,'manna and daniel still pending');
 const done=[...runs,{id:3,display_title:'production-bible-manna-005',conclusion:'success',created_at:'2026-11-04T06:00:00Z',updated_at:'2026-11-04T08:00:00Z',status:'completed'}];
 assert.equal(needsTopics(c,done),true);
 const rolled=monthlyProduction.parse(rollQueue(c,done,[{runId:'bible-babel-007',topic:'The Tower of Babel: the bricks and the scattering'},{runId:'bible-ruth-008',topic:'Ruth and Naomi: from Moab to Bethlehem and back'}],now));
 assert.deepEqual(rolled.episodes.map(e=>e.runId),['bible-jonah-004','bible-manna-005','bible-daniel-006','bible-babel-007'],'noah left the queue; one topic tops pending up to two');
 assert.equal(rolled.episodes.at(-1)!.notBefore,'2026-11-16T00:00:00.000Z');assert.equal(rolled.startsAt,'2026-11-05T00:00:00.000Z');
});

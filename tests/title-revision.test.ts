import {test} from 'node:test';import assert from 'node:assert/strict';
import {prepareTitleRevision,metadataInvariant,titleRevisionSnapshot} from '../src/youtube/title-revision';
const change={videoId:'abcdefghijk',expectedTitle:'Original title',title:'Improved title',translations:{es:'Título mejorado'}};
const video={id:'abcdefghijk',snippet:{channelId:'UCexample',title:'Original title',description:'Sources https://example.org plus support https://ko-fi.com/bibleunearthed',categoryId:'27',tags:['bu-run','source'],defaultLanguage:'en',defaultAudioLanguage:'en'},status:{privacyStatus:'public',publishAt:'2026-10-01T17:00:00Z'},localizations:{es:{title:'Título original',description:'Fuentes sin cambios'},fr:{title:'Titre original',description:'Texte original'}}};
test('title update preserves descriptions, tags, languages and translations while omitting status writes',()=>{
 const result=prepareTitleRevision(video,change,'UCexample');assert.equal(result.changed,true);assert.equal(result.request.status,undefined);assert.equal(result.request.snippet!.description,video.snippet.description);assert.deepEqual(result.request.snippet!.tags,video.snippet.tags);assert.equal(result.request.localizations!.es.title,'Título mejorado');assert.equal(result.request.localizations!.es.description,'Fuentes sin cambios');assert.deepEqual(result.request.localizations!.fr,video.localizations.fr);
 const updated={...video,snippet:{...video.snippet,...result.request.snippet},localizations:result.request.localizations};assert.deepEqual(metadataInvariant(updated),metadataInvariant(video));assert.equal(prepareTitleRevision(updated,change,'UCexample').changed,false);
});
test('foreign channel and concurrent manual title edits block metadata replacement',()=>{
 assert.throws(()=>prepareTitleRevision(video,change,'UCother'),/approved channel/);assert.throws(()=>prepareTitleRevision({...video,snippet:{...video.snippet,title:'Owner just edited this'}},change,'UCexample'),/since review/);
});

test('backup comparison ignores API response order and volatile etags but still detects metadata changes',()=>{
 const second={...video,id:'lmnopqrstuv',etag:'old'};
 assert.deepEqual(titleRevisionSnapshot([video,second]),titleRevisionSnapshot([{...second,etag:'new'},{...video,etag:'different'}]));
 assert.notDeepEqual(titleRevisionSnapshot([video]),titleRevisionSnapshot([{...video,snippet:{...video.snippet,description:'Owner edited the description'}}]));
});

import {test} from 'node:test';import assert from 'node:assert/strict';
import {ZernioClient,requireTikTokConsent} from '../src/social/publish';
test('TikTok consent cannot be fabricated from general scheduling intent or omitted interaction choices',()=>{
 assert.throws(()=>requireTikTokConsent({}),/owner review/);assert.throws(()=>requireTikTokConsent({CONTENT_PREVIEW_CONFIRMED:'true',EXPRESS_CONSENT_GIVEN:'true'}));
 const settings=requireTikTokConsent({CONTENT_PREVIEW_CONFIRMED:'true',EXPRESS_CONSENT_GIVEN:'true',ALLOW_COMMENT:'allow',ALLOW_DUET:'disable',ALLOW_STITCH:'disable'});assert.equal(settings.allow_comment,true);assert.equal(settings.allow_duet,false);
});
test('Zernio account discovery is read-only and rejects ambiguous destinations',async()=>{
 const client=new ZernioClient('mock-only',async(url,options)=>{assert.equal(String(url),'https://zernio.com/api/v1/accounts');assert.equal(options?.method,'GET');assert.equal(options?.redirect,'error');return new Response(JSON.stringify({accounts:[{_id:'a'.repeat(24),platform:'tiktok'},{_id:'b'.repeat(24),platform:'tiktok'}]}));});await assert.rejects(client.account(),/Exactly one/);
});

test('Shorts translations retain exact episode/support destinations and conventional biblical names',async()=>{
 const {shortMetadata}=await import('../src/social/localize');const m=shortMetadata({id:'B',title:'Why These Biblical Beings Have Six Wings',source:'Isaiah 6:1-7'},'video123');
 for(const v of [m,...Object.values(m.localizations)]){assert.ok(v.description.includes('https://www.youtube.com/watch?v=video123'));assert.ok(v.description.includes('https://ko-fi.com/bibleunearthed'));assert.ok(v.title.length<=100);}
 assert.match(m.localizations.es.description,/Isaías 6:1-7/);assert.throws(()=>shortMetadata({id:'D',title:'Unsupported',source:'Source'},'id'),/missing/);
});

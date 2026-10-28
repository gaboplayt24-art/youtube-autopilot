import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applySecondReview,secondReviewPrompt} from '../src/visuals/second-review';
import {artworkIdea} from '../src/visuals/illustration-schema';
const idea=artworkIdea.parse({id:'goats',narration:'the male and his female',historicalContext:'Genesis 7 animals.',concept:'Eli standing near a pen containing a pair of goats, gesturing to the two animals.',overlay:null,labelPlacement:'top',characterRoles:['Eli']});
const accepted={passed:true,objectiveFailures:[] as string[],issues:[] as string[]};
test('the second reviewer can only add objective rejections, never accept, and never judges layout',()=>{
 const clean={distinctPeople:1,unrequestedPeople:false,missingRequiredObjects:[],fusedOrDuplicatedBodies:false,detail:'Eli and two goats.'};
 assert.equal(applySecondReview(accepted,clean),accepted);
 const caught=applySecondReview(accepted,{distinctPeople:2,unrequestedPeople:true,missingRequiredObjects:['pen'],fusedOrDuplicatedBodies:true,detail:'A second child figure; one goat body has two heads.'});
 assert.equal(caught.passed,false);assert.deepEqual(caught.objectiveFailures,['secondReviewUnrequestedPeople','secondReviewMissingObject','secondReviewFusedBody']);
 assert.match(caught.issues[0],/two heads.*Missing: pen/);
 const prompt=secondReviewPrompt(idea);assert.match(prompt,/requested cast is: Eli/);assert.match(prompt,/ignore style, layout, borders/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {oneConcept} from '../src/packaging/thumbnails';
const scores={clarity:90,curiosity:90,emotionalImpact:90,mobileReadability:90,subjectProminence:90,differentiation:90,brandConsistency:90};
const concept=(id:string)=>({id,composition:'left-subject',focalSubject:'Eli beside a giant',expressionOrSituation:'Eli gasps',background:'plain teal',overlay:'GIANTS?',curiosity:'Who were they?',scores});
test('a finalized thumbnail concept returned as an array keeps the one for this id',()=>{
 assert.equal(oneConcept('b').parse([concept('a'),concept('b'),concept('c')]).id,'b');
 assert.equal(oneConcept('z').parse([concept('a'),concept('b')]).id,'a');
 assert.equal(oneConcept('a').parse(concept('a')).id,'a');
 assert.throws(()=>oneConcept('a').parse([]));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSearchInputController } from '../src/shared/search-input.ts';

test('Korean IME completes without arrow key, jamo invalidates stale requests, clear restores empty query',()=>{
  let value='',version=0;const scheduled=[],deferred=[];
  const controller=createSearchInputController(()=>value,v=>scheduled.push(v),()=>++version,fn=>deferred.push(fn));
  controller.compositionStart();value='서';controller.input({isComposing:true});
  deferred.splice(0).forEach(fn=>fn());assert.deepEqual(scheduled,['서']);
  const requestVersion=version;value='서ㅇ';controller.input({isComposing:true});
  deferred.splice(0).forEach(fn=>fn());assert.ok(version>requestVersion);assert.deepEqual(scheduled,['서']);
  value='서울';controller.compositionEnd();deferred.splice(0).forEach(fn=>fn());assert.equal(scheduled.at(-1),'서울');
  controller.reset();value='';controller.input({isComposing:false});assert.equal(scheduled.at(-1),'');
  for(const text of ['A','a','1']){value=text;controller.input({isComposing:false});assert.equal(scheduled.at(-1),text);}
});

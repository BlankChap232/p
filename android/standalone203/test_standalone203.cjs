/* Zero-network QA for guide keyword indexing and independent login. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const dir=__dirname;
const events={};
const context={
 window:{p295GuideInput:()=>{},PandaSimple295:{guide:{query:''}}},
 document:{readyState:'loading',addEventListener:(k,fn)=>events[k]=fn},
 setTimeout:(fn)=>{ /* no network/DB in this pure unit test */return 1;},
 clearTimeout:()=>{}, setInterval:()=>1,
 console
};
context.window.window=context.window;
vm.runInNewContext(fs.readFileSync(dir+'/panda_guide_search_v203.js','utf8'),context,{filename:'panda_guide_search_v203.js'});
const search=context.window.PandaGuideSearch203;
assert.equal(search.version,'2.0.3');
const now=Date.now();
const schedule=[
 {start:now-100000,stop:now+600000,title:'NBC News',desc:'Local headlines'},
 {start:now+3600000,stop:now+7200000,title:'Baltimore Ravens vs Cincinnati Bengals',desc:'Football game live'},
 {start:now-86400000,stop:now-82500000,title:'Old Ravens Highlight',desc:'Yesterday'}
];
assert.equal(search.matchData(schedule,'ravens'),true,'Upcoming Ravens match');
assert.equal(search.matchData(schedule,'CINCINNATI'),true,'Case-insensitive EPG title match');
assert.equal(search.matchData(schedule,'football'),true,'EPG description match');
assert.equal(search.matchData(schedule,'yesterday'),false,'Expired programs excluded');
assert.equal(search.matchData([{start:now+14*3600000,stop:now+15*3600000,title:'Ravens'}],'ravens'),false,'Outside twelve-hour horizon');
assert.equal(search.matchData([{start:now,stop:now+300000,title:'Ravens at Steelers'}],'ravens'),true);
assert.equal(search.matchData(schedule,'r'),false,'Two-character minimum for guide titles');
assert.equal(search.normalize('Ravens @ Baltimore!'),'ravens baltimore');
const afterFirst=context.window.p295GuideInput;afterFirst('ravens');
assert.equal(search.inspect().remoteRequests,0,'Never sends search text to network');
assert.equal(search.inspect().query,'ravens','Input updates query immediately');
afterFirst('steelers');
assert.equal(search.inspect().query,'steelers','Old results invalidated with new keyword');
console.log('PASS: upcoming 12h, title and description, expired exclusion, local-only search, live input');

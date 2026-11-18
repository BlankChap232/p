const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname+'/panda_home_focus_v218.js','utf8');
const calls = {scroll:0,keys:0};
const classes = array => ({
  s:new Set(array),
  contains(x){return this.s.has(x);},
  add(x){this.s.add(x);},
  remove(x){this.s.delete(x);}
});
const document = {activeElement:null,fullscreenElement:null,
  body:{classList:classes([])},
  querySelector(){return null;}
};
function node(label,x,y,zone,clicked=true){
  const attrs={};
  const el={
    isConnected:true,label,rect:{left:x,top:y,right:x+90,bottom:y+64,width:90,height:64},zone,
    classList:classes([]), tagName:'DIV', parentElement:null,
    textContent:label, tabIndex:-1,
    getBoundingClientRect(){return this.rect;},
    getAttribute(n){return attrs[n]??null;},
    setAttribute(n,v){attrs[n]=String(v);},
    hasAttribute(n){return Object.hasOwn(attrs,n);},
    closest(sel){
      if(sel==='[hidden],[inert]')return null;
      if(sel.startsWith('input,')&&this.zone==='input')return this;
      if(sel==='header,.top,.eliteHero'&&['hero','header'].includes(this.zone))return this;
      if(sel==='.eliteSection'&&this.zone==='section')return this;
      return null;
    },
    focus(){document.activeElement=this;},
    scrollIntoView(){calls.scroll++;},
  };
  if(clicked)attrs.onclick="openPage()";
  return el;
}
const tiles=[
  node('Live TV',0,220,'tile'),node('Movies',100,220,'tile'),
  node('Series',200,220,'tile'),node('Sports',300,220,'tile'),
  node('Kids',0,310,'tile'),node('My List',100,310,'tile'),
  node('Settings',300,310,'tile')
];
const hero=node('Watch Live',0,20,'hero',false);
const header=node('Top search',0,-40,'header',false);
const input=node('Search input',100,20,'input',false);
const section=node('Continue Watching item',0,550,'section');
const tab=node('Home tab',0,750,'nav',false);
const body=node('body',0,0,'body',false);
const main={
  querySelectorAll(s){
    if(s.includes('.quickGrid .quickTile'))return tiles;
    if(s==='.ptv-remote-focus')return tiles.concat([hero,section]).filter(n=>n.classList.contains('ptv-remote-focus'));
    if(s.includes('.eliteSection .sectionHead'))return [section];
    throw Error('Unexpected selector: '+s);
  },
  querySelector(s){
    if(s==='.eliteHero .heroActions button:not([disabled])')return hero;
    return null;
  },
  contains(n){return [hero,input,section,...tiles].includes(n);}
};
const nav={contains(n){return n===tab;}};
const global={window:{}, document, state:{route:'home'},
  getComputedStyle(){return {display:'block',visibility:'visible',pointerEvents:'auto'};},
  console,Array,Math,Set,Object,String,Number
};
document.getElementById=id=>id==='main'?main:id==='nav'?nav:null;
vm.createContext(global);
vm.runInContext(source,global,{filename:'panda_home_focus_v218.js'});
const focus=global.window.PandaHomeFocus218;
assert.ok(focus,'Home focus engine registered');
function fire(start,key){
  document.activeElement=start;
  calls.keys++;
  return focus.handleKey({key,defaultPrevented:false,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false});
}
assert.equal(fire(hero,'ArrowDown'),true,'Down from hero is handled before page scroller');
assert.equal(document.activeElement,tiles[0],'Home hero enters LIVE first');
assert.equal(tiles[0].tabIndex,0,'Live tile is remote-focusable');
assert.equal(tiles[0].getAttribute('role'),'button','Live tile remains activatable via OK');
assert.equal(fire(header,'ArrowDown'),true);
assert.equal(document.activeElement,tiles[0],'Header enters first tile');
assert.equal(fire(tab,'ArrowDown'),true);
assert.equal(document.activeElement,tiles[0],'Nav tabs enter first tile');
assert.equal(fire(body,'ArrowDown'),true);
assert.equal(document.activeElement,tiles[0],'Lost focus recovers to Live TV');
assert.equal(fire(tiles[0],'ArrowRight'),true);
assert.equal(document.activeElement,tiles[1],'Right from Live goes to Movies');
assert.equal(fire(tiles[1],'ArrowRight'),true);
assert.equal(document.activeElement,tiles[2],'Right from Movies goes to Series');
assert.equal(fire(tiles[0],'ArrowDown'),true);
assert.equal(document.activeElement,tiles[4],'Down within grid reaches second row');
assert.equal(fire(tiles[4],'ArrowUp'),true);
assert.equal(document.activeElement,tiles[0],'Up within grid returns to first row');
assert.equal(fire(tiles[0],'ArrowUp'),true);
assert.equal(document.activeElement,hero,'Up from quick row returns to hero');
assert.equal(fire(tiles[6],'ArrowDown'),true);
assert.equal(document.activeElement,section,'Down beyond grid enters next Home section');
assert.equal(fire(section,'ArrowUp'),true);
assert.equal(document.activeElement,tiles[0],'Up from lower Home section returns to quick navigation');
assert.equal(fire(input,'ArrowDown'),false,'Text fields retain normal keyboard behavior');
document.body.classList.add('p165SetupActive');
assert.equal(fire(hero,'ArrowDown'),false,'First login setup retains keyboard control');
document.body.classList.remove('p165SetupActive');
global.state.route='live';
assert.equal(fire(hero,'ArrowDown'),false,'Live guide uses existing guide navigation');
global.state.route='movies';
assert.equal(fire(tiles[0],'ArrowDown'),false,'Movies use existing category navigation');
global.state.route='home';
const count=focus.inspect().handled;
assert.ok(count>=11,'test actually exercised Home navigation');
assert.ok(calls.scroll>=11,'focused items brought into view');
console.log('PASS: Home Live/Movies/Series D-pad entry, grid row and column navigation, lower sections, setup and guide isolation');

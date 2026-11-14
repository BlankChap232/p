/* Panda Tv Elite 2.0.3 — standalone three-field provider setup.
   Works with existing Xtream/M3U settings; no owner-console authorization. */
(function(){
'use strict';
if(window.PandaStandalone203)return;
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el=id=>document.getElementById(id);
function openLogin(){
  if(window.PandaV291?.syncing||(typeof state==='object'&&state.syncing)){
    if(typeof toast==='function')toast('Finish the current provider update first');
    return false;
  }
  if(typeof window.PandaPhase1?.openLogin==='function')window.PandaPhase1.openLogin();
  else if(typeof window.pandaV291EditLogin==='function')window.pandaV291EditLogin();
  else if(typeof window.go==='function')window.go('settings');
  return true;
}
function togglePassword(button,id){
  const field=el(id);if(!field)return;
  field.type=field.type==='password'?'text':'password';
  if(button)button.textContent=field.type==='password'?'Show':'Hide';
}
const oldSettings=window.settings;
if(typeof oldSettings==='function'){
 window.settings=settings=function(...args){
  const original=oldSettings.apply(this,args),template=document.createElement('template');
  template.innerHTML=original;
  const grid=template.content.querySelector('.p295SettingsGrid');
  const card=grid?.querySelector('.p295SettingCard');
  if(!grid||!card)return original;
  const p=profile(),mode=p.direct&&!(p.server&&p.username&&p.password)?'m3u':'xtream';
  card.classList.add('p203QuickCard');
  card.innerHTML=[
    '<div class="p203QuickHeader"><h2>Connect your TV provider</h2>',
    '<p>Just three details. No owner-console permission needed.</p></div>',
    '<label for="p295ProviderMode" class="p203ModeLabel">Connection type</label>',
    '<select class="field" id="p295ProviderMode" onchange="p295SetProviderMode(this.value)">',
    '<option value="xtream" '+(mode==='xtream'?'selected':'')+'>Username + password</option>',
    '<option value="m3u" '+(mode==='m3u'?'selected':'')+'>M3U playlist URL</option></select>',
    '<div id="p295XtreamFields" '+(mode==='m3u'?'hidden':'')+'>',
    '<label for="server">Server URL</label>',
    '<input class="field" id="server" type="url" value="'+safe(p.server||'')+'" ',
      'placeholder="http://provider.example:8080" autocomplete="off" autocorrect="off" ',
      'autocapitalize="off" spellcheck="false">',
    '<label for="username">Username</label>',
    '<input class="field" id="username" type="text" value="'+safe(p.username||'')+'" ',
      'autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false">',
    '<label for="password">Password</label>',
    '<div class="p203PasswordRow"><input class="field" id="password" type="password" ',
       'value="" placeholder="'+(p.password?'Saved — leave blank to keep':'Enter provider password')+'" ',
       'autocomplete="current-password" autocapitalize="off" spellcheck="false">',
    '<button type="button" class="btn" onclick="PandaStandalone203.togglePassword(this,',
       "'password'"+')">Show</button></div></div>',
    '<div id="p295M3uFields" '+(mode==='xtream'?'hidden':'')+'>',
    '<label for="direct">M3U playlist URL</label>',
    '<input class="field" id="direct" type="url" value="'+safe(p.direct||'')+'" ',
      'placeholder="https://provider.example/playlist.m3u" autocapitalize="off" ',
      'autocorrect="off" spellcheck="false"></div>',
    '<input type="hidden" id="name" value="'+safe(p.name||'Panda Profile')+'">',
    '<div class="p203QuickActions">',
    '<button type="button" class="btn primary" onclick="p295SaveSettings(true)">Save &amp; Connect</button>',
    '<button type="button" class="btn" onclick="p295SaveSettings(false)">Save only</button></div>',
    '<p id="p295SaveStatus" class="p203Status" role="status" aria-live="polite"></p>',
    '<p class="p203Footnote">Wrong password? Use <b>Edit Login</b> at the top any time. ',
      'A rejected connection also reopens the editor automatically.</p>'
  ].join('');
  const rest=Array.from(grid.children).filter(c=>c!==card);
  if(rest.length){
    const advanced=document.createElement('details');
    advanced.className='p203Advanced';
    const summary=document.createElement('summary');
    summary.textContent='Advanced settings: EPG, playback & diagnostics';
    const nested=document.createElement('div');
    nested.className='p203AdvancedGrid';
    for(const node of rest)nested.appendChild(node);
    advanced.append(summary,nested);grid.appendChild(advanced);
  }
  return template.innerHTML;
 };
}
function installTopButton(){
  const actions=document.querySelector('.topActions');
  if(!actions||el('p203EditTop'))return;
  const btn=document.createElement('button');
  btn.id='p203EditTop';btn.type='button';btn.className='btn p203EditTop';
  btn.setAttribute('aria-label','Edit provider server URL, username and password');
  btn.title='Edit provider login';btn.textContent='Edit Login';
  btn.addEventListener('click',openLogin);
  const first=actions.querySelector('button');
  if(first)actions.insertBefore(btn,first);else actions.appendChild(btn);
}
document.addEventListener('focusin',event=>{
  const field=event.target;
  if(!field?.closest?.('#p291CredentialForm'))return;
  setTimeout(()=>{
    if(document.activeElement!==field)return;
    try{field.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'})}
    catch(_){try{field.scrollIntoView(false)}catch(__){}}
  },190);
},true);
if(document.readyState==='loading')
 document.addEventListener('DOMContentLoaded',installTopButton,{once:true});
else installTopButton();
window.PandaStandalone203=Object.freeze({version:'2.0.3',openLogin,togglePassword,installTopButton});
})();
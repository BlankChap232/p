/* Panda Tv Elite 2.0.2 — Customer Center QA. No production API calls. */
(function(){
  'use strict';
  const key='pandaEliteCustomerCenterDraftsV202';
  const clean=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const topics=['Playback / black screen','TV Guide / EPG','Login / account','Movies / series','Remote / controls','Other'];
  const urgencies=['Normal','Low','High'];
  const referrals=['Friend or family','Social media','Other'];
  function load(){
    try{
      const d=JSON.parse(localStorage.getItem(key)||'{}');
      return {tickets:Array.isArray(d.tickets)?d.tickets.slice(-30):[],referrals:Array.isArray(d.referrals)?d.referrals.slice(-30):[]};
    }catch(_){return {tickets:[],referrals:[]};}
  }
  function save(data){localStorage.setItem(key,JSON.stringify({tickets:data.tickets.slice(-30),referrals:data.referrals.slice(-30)}));}
  function opts(a){return a.map(x=>'<option value="'+clean(x)+'">'+clean(x)+'</option>').join('');}
  function history(data){
    if(!data.tickets.length&&!data.referrals.length)return '<p class="pandaCcMuted">Nothing saved on this device yet.</p>';
    return data.tickets.slice(-8).reverse().map(x=>'<div class="pandaCcDraft"><b>Support draft · '+clean(x.topic)+'</b><small>'+clean(x.when)+' · Not sent</small><p>'+clean(x.body).slice(0,200)+'</p></div>').join('')+
           data.referrals.slice(-8).reverse().map(x=>'<div class="pandaCcDraft"><b>Referral note · '+clean(x.type)+'</b><small>'+clean(x.when)+' · Not submitted</small><p>'+clean(x.note).slice(0,200)+'</p></div>').join('');
  }
  function render(){
    const d=load();
    return '<div class="pandaCc"><div class="pandaCcTop"><button class="btn" type="button" onclick="go(\'settings\')">← Settings</button><div><h1>Panda Elite Customer Center</h1><p>Help, feedback and referrals</p></div></div>'+
    '<div class="pandaCcAlert"><b>Owner messaging not connected.</b> This build saves drafts on this device only. It does not send a ticket, approve access, or award referral credits. A secure customer account backend is required.</div>'+
    '<div class="pandaCcGrid"><section class="pandaCcCard"><h2>Customer Service</h2><p class="pandaCcMuted">Select an issue and save a draft for later support activation.</p>'+
    '<label>Your contact email<input id="pandaCcEmail" maxlength="254" autocomplete="email" type="email" placeholder="you@example.com"></label>'+
    '<label>Issue category<select id="pandaCcTopic">'+opts(topics)+'</select></label>'+
    '<label>Priority<select id="pandaCcUrgency">'+opts(urgencies)+'</select></label>'+
    '<label>Describe the issue<textarea id="pandaCcBody" maxlength="1800" rows="5" placeholder="Tell us what happened. Never include passwords or provider credentials."></textarea></label>'+
    '<button class="btn primary" type="button" data-panda-cc-action="draft-ticket">Save support draft</button>'+
    '</section><section class="pandaCcCard"><h2>Referrals</h2><p class="pandaCcMuted">Referral codes are issued by the owner after customer activation. No code or reward has been assigned yet.</p>'+
    '<label>Referral method<select id="pandaCcReferralType">'+opts(referrals)+'</select></label>'+
    '<label>Referral note<textarea id="pandaCcReferralNote" maxlength="700" rows="4" placeholder="A note about who you would like to refer. Avoid entering other people\'s private details without consent."></textarea></label>'+
    '<button class="btn primary" type="button" data-panda-cc-action="draft-referral">Save referral note</button>'+
    '<h3>My access status</h3><p class="pandaCcMuted">Not connected to Panda Elite Access yet. Your provider account and the owner approval system are separate.</p>'+
    '</section></div>'+
    '<section class="pandaCcCard"><h2>Saved on this device</h2><div id="pandaCcDraftHistory">'+history(d)+'</div><p class="pandaCcMuted">Drafts are local. Clearing app storage or uninstalling may erase them.</p></section></div>';
  }
  function text(id){return String(document.getElementById(id)?.value||'').trim();}
  function toastMessage(m){
    if(typeof window.toast==='function')window.toast(m);
    else{const e=document.getElementById('pandaCcAlertToast');if(e)e.textContent=m;}
  }
  document.addEventListener('click',function(e){
    const button=e.target.closest('[data-panda-cc-action]');if(!button)return;
    e.preventDefault();
    const d=load(),action=button.getAttribute('data-panda-cc-action'),when=new Date().toISOString();
    if(action==='draft-ticket'){
      const body=text('pandaCcBody'),email=text('pandaCcEmail');
      if(body.length<10||body.length>1800){toastMessage('Please describe the issue in at least 10 characters.');return;}
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toastMessage('Enter your email address.');return;}
      d.tickets.push({email,topic:text('pandaCcTopic'),urgency:text('pandaCcUrgency'),body,when});
      save(d);
      const field=document.getElementById('pandaCcBody');if(field)field.value='';
      toastMessage('Saved on this device only — not sent to support.');
    } else if(action==='draft-referral'){
      const note=text('pandaCcReferralNote');
      if(note.length<4){toastMessage('Add a short referral note first.');return;}
      d.referrals.push({type:text('pandaCcReferralType'),note,when});
      save(d);
      const field=document.getElementById('pandaCcReferralNote');if(field)field.value='';
      toastMessage('Referral note saved locally — not submitted.');
    }
    const list=document.getElementById('pandaCcDraftHistory');
    if(list)list.innerHTML=history(d);
  },true);
  window.PandaCustomerCenter202={render,load};
})();
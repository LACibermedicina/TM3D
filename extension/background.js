/* Tm3d chaveiro · background — mantém a ponte WS com o DApp e decifra registros */
'use strict';
const st = { ws:null, server:null, code:null, recs:[], pareado:false };
const enc=new TextEncoder(), dec=new TextDecoder();
const b642buf=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer;

function avisaPopup(){ browser.runtime.sendMessage({type:'bg', pareado:st.pareado, server:st.server, recs:st.recs}).catch(()=>{}); }
async function salva(){ await browser.storage.local.set({tm3d:{server:st.server, code:st.code, pareado:st.pareado}}); }

function conecta(){
  if(!st.server) return;
  try{ st.ws=new WebSocket(st.server.replace(/^http/,'ws')+'/ws?role=ext'); }catch(e){ return; }
  st.ws.onopen=()=>{ if(st.code) st.ws.send(JSON.stringify({type:'pair', code:st.code})); };
  st.ws.onclose=()=>{ st.pareado=false; avisaPopup(); setTimeout(conecta, 4000); };
  st.ws.onerror=()=>{};
  st.ws.onmessage=async ev=>{
    let m; try{ m=JSON.parse(ev.data); }catch(e){ return; }
    if(m.type==='recs'){ st.recs=m.payload||[]; st.pareado=true; await salva(); avisaPopup(); }
    else if(m.type==='rec'){ await entregaRec(m); }
    else if(m.type==='rec-denied'){ browser.runtime.sendMessage({type:'rec-denied', recId:m.recId}).catch(()=>{}); }
  };
}

async function entregaRec(m){
  // decifra com a chave de sessão derivada do código de 6 dígitos
  const key=await crypto.subtle.importKey('raw',
    await crypto.subtle.digest('SHA-256', enc.encode('TM3D-PAIR-'+st.code)),
    {name:'AES-GCM'}, false, ['decrypt']);
  try{
    const pt=await crypto.subtle.decrypt({name:'AES-GCM', iv:new Uint8Array(b642buf(m.iv))}, key, b642buf(m.ct));
    if(m.binario){
      const url=URL.createObjectURL(new Blob([pt]));
      await browser.downloads.download({url, filename:m.nomeArq||'tm3d-registro', saveAs:true});
      browser.runtime.sendMessage({type:'rec-ok', recId:m.recId, binario:true}).catch(()=>{});
    }else{
      browser.runtime.sendMessage({type:'rec-ok', recId:m.recId, titulo:m.titulo, texto:dec.decode(pt)}).catch(()=>{});
    }
  }catch(e){ browser.runtime.sendMessage({type:'rec-erro', recId:m.recId}).catch(()=>{}); }
}

browser.runtime.onMessage.addListener(async m=>{
  if(m.type==='parear'){ st.server=m.server; st.code=m.code; await salva(); conecta(); return {ok:true}; }
  if(m.type==='pedir'&&st.ws&&st.ws.readyState===1){ st.ws.send(JSON.stringify({type:'req', recId:m.recId})); return {ok:true}; }
  if(m.type==='status'){ return {pareado:st.pareado, server:st.server, recs:st.recs}; }
  if(m.type==='desparear'){ st.code=null; st.pareado=false; st.recs=[]; await salva(); if(st.ws)st.ws.close(); avisaPopup(); return {ok:true}; }
});

(async()=>{ const j=await browser.storage.local.get('tm3d');
  if(j.tm3d){ st.server=j.tm3d.server; st.code=j.tm3d.code; if(st.server)conecta(); } })();

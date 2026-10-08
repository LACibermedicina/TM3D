/* Tm3d chaveiro · popup */
'use strict';
const $=s=>document.querySelector(s);
const KINDS={1:'🧪',2:'🩻',3:'💊',4:'📝'};

async function status(){
  const r=await browser.runtime.sendMessage({type:'status'});
  pinta(r);
}
function pinta(r){
  const on=r&&r.pareado;
  $('#dot').classList.toggle('on',!!on);
  $('#st-txt').textContent=on?('Pareado com '+(r.server||'DApp')):'Não pareado';
  $('#v-parear').hidden=!!on; $('#v-cofre').hidden=!on;
  if(on){
    $('#in-server').value=r.server||'';
    $('#lista').innerHTML=(r.recs&&r.recs.length)?r.recs.map(d=>
      `<div class="rec"><span class="em">${KINDS[d.tipo]||'📄'}</span>
       <div><b>${d.titulo.replace(/</g,'&lt;')}</b><small>${new Date(d.at).toLocaleString('pt-BR')}${d.shredded?' · 🗑 eliminado':''}</small></div>
       ${d.shredded?'':`<button class="forte" data-rec="${d.id}">Abrir</button>`}</div>`).join('')
      :'<p class="miudo">Cofre vazio — guarde algo no DApp. 🌱</p>';
    document.querySelectorAll('[data-rec]').forEach(b=>b.onclick=()=>{
      b.textContent='…'; browser.runtime.sendMessage({type:'pedir',recId:b.dataset.rec});
    });
  }
}
$('#bt-parear').onclick=async()=>{
  let sv=$('#in-server').value.trim()||'http://localhost:8791';
  const cd=$('#in-code').value.trim();
  if(!/^\d{6}$/.test(cd)){$('#in-code').focus();$('#in-code').style.borderColor='#FF6B9D';return;}
  await browser.runtime.sendMessage({type:'parear',server:sv,code:cd});
  $('#st-txt').textContent='Pareando… (confirme o código no DApp)';
};
$('#bt-desparear').onclick=async()=>{await browser.runtime.sendMessage({type:'desparear'});status();};
$('#bt-atual').onclick=status;

/* leitura de QR: extrai código/servidor do payload tm3d://pair?ws=…&code=…… */
$('#bt-cam').onclick=async()=>{
  const v=$('#cam');v.hidden=false;
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    v.srcObject=stream;await v.play();
    const cv=document.createElement('canvas'),cx=cv.getContext('2d');
    const tick=async()=>{
      if(v.hidden){stream.getTracks().forEach(t=>t.stop());return;}
      if(v.videoWidth){
        cv.width=v.videoWidth;cv.height=v.videoHeight;cx.drawImage(v,0,0);
        if(window.jsQR){
          const img=cx.getImageData(0,0,cv.width,cv.height);
          const q=jsQR(img.data,img.width,img.height);
          if(q&&q.data){
            const m=/[?&]code=(\d{6})/.exec(q.data);
            const ws=/[?&]ws=([^&]+)/.exec(q.data);
            if(m){$('#in-code').value=m[1];if(ws)$('#in-server').value=decodeURIComponent(ws[1]).replace(/^ws/,'http');
              v.hidden=true;$('#bt-parear').click();return;}
          }
        }
      }
      setTimeout(tick,350);
    };
    tick();
    if(!window.jsQR){$('.dica').textContent='📷 Câmera aberta — o leitor automático de QR não está incluído neste build; digite o código de 6 dígitos ao lado do QR.';}
  }catch(e){ v.hidden=true; $('.dica').textContent='⚠️ Sem acesso à câmera — digite o código de 6 dígitos.'; }
};

browser.runtime.onMessage.addListener(m=>{
  if(m.type==='bg'){pinta({pareado:m.pareado,server:m.server,recs:m.recs});}
  else if(m.type==='rec-ok'){
    if(m.binario){$('#saida').innerHTML='<div class="leitura">📎 Arquivo decifrado — download iniciado. ⬇</div>';}
    else{$('#saida').innerHTML=`<div class="leitura"><b>${(m.titulo||'').replace(/</g,'&lt;')}</b>\n\n${m.texto.replace(/</g,'&lt;')}</div>`;}
    status();
  }
  else if(m.type==='rec-denied'){$('#saida').innerHTML='<div class="leitura">⛔ Registro indisponível (eliminado ou sessão expirada).</div>';status();}
  else if(m.type==='rec-erro'){$('#saida').innerHTML='<div class="leitura">😕 Não foi possível decifrar.</div>';status();}
});
status();

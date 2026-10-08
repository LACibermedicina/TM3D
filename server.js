#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
   Tm3d · servidor da rede local (tm3d-local-sim, chainid 79999)
   Node.js puro, ZERO dependências (npm install não é necessário).
   - serve o DApp (public/)
   - relê WebSocket /ws que conecta o DApp (aba) ⇄ extensão Firefox
   Uso:  node server.js [porta]        (padrão 8791)
   ═══════════════════════════════════════════════════════════════════ */
'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=+(process.argv[2]||process.env.PORT||8791);
const ROOT=path.join(__dirname,'public');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};

const server=http.createServer((req,res)=>{
  let p=decodeURIComponent((req.url||'/').split('?')[0]);
  if(p==='/')p='/index.html';
  if(p==='/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({rede:'tm3d-local-sim',chainId:79999,ok:true}));}
  const f=path.normalize(path.join(ROOT,p));
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){
    res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});return res.end('404 — não encontrado');
  }
  res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});
  fs.createReadStream(f).pipe(res);
});

/* ── relê WebSocket mínimo (RFC 6455, frames de texto) ── */
const GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const clients=new Set(); // {sock, role}
function wsSend(c,obj){
  try{
    const p=Buffer.from(JSON.stringify(obj));
    const n=p.length;let head;
    if(n<126){head=Buffer.from([0x81,n]);}
    else if(n<65536){head=Buffer.alloc(4);head[0]=0x81;head[1]=126;head.writeUInt16BE(n,2);}
    else{head=Buffer.alloc(10);head[0]=0x81;head[1]=127;head.writeBigUInt64BE(BigInt(n),2);}
    c.sock.write(Buffer.concat([head,p]));
  }catch(e){}
}
server.on('upgrade',(req,sock)=>{
  if(!req.url.startsWith('/ws')){sock.destroy();return;}
  const key=req.headers['sec-websocket-key'];
  if(!key){sock.destroy();return;}
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+
    crypto.createHash('sha1').update(key+GUID).digest('base64')+'\r\n\r\n');
  const role=/role=ext/.test(req.url)?'ext':'web';
  const c={sock,role};clients.add(c);
  console.log('⇄ conectou:',role,'· total',clients.size);
  sock.on('data',buf=>{
    // decodifica frames (mensagens pequenas, texto)
    let off=0;
    while(off+2<=buf.length){
      const fin=buf[off]&0x80,op=buf[off]&0x0f,masked=buf[off+1]&0x80;
      let len=buf[off+1]&0x7f,h=2;
      if(len===126){if(off+4>buf.length)return;len=buf.readUInt16BE(off+2);h=4;}
      else if(len===127){if(off+10>buf.length)return;len=Number(buf.readBigUInt64BE(off+2));h=10;}
      const mask=masked?buf.slice(off+h,off+h+4):null;const hs=h+(masked?4:0);
      if(off+hs+len>buf.length)return;
      let data=buf.slice(off+hs,off+hs+len);
      if(mask)for(let i=0;i<data.length;i++)data[i]^=mask[i%4];
      off+=hs+len;
      if(op===8){sock.end();return;}
      if(op===9){const pong=Buffer.from([0x8a,0]);sock.write(pong);continue;}
      if(op!==1||!fin)continue;
      let msg;try{msg=JSON.parse(data.toString());}catch(e){continue;}
      // retransmite para o outro lado
      const alvo=role==='ext'?'web':'ext';
      for(const o of clients)if(o.role===alvo)wsSend(o,msg);
    }
  });
  const bye=()=>{clients.delete(c);console.log('✕ saiu:',role,'· total',clients.size);};
  sock.on('close',bye);sock.on('error',bye);
});

server.listen(PORT,()=>{
  console.log('');
  console.log('  🧬 Tm3d · rede local tm3d-local-sim (chainid 79999)');
  console.log('  ────────────────────────────────────────────────');
  console.log('  DApp:      http://localhost:'+PORT);
  const os=require('os');
  for(const [nome,ifs] of Object.entries(os.networkInterfaces()))
    for(const i of ifs||[])if(i.family==='IPv4'&&!i.internal)
      console.log('  Na rede:   http://'+i.address+':'+PORT+'   ← use este IP no celular/extensão');
  console.log('  Relê WS:   ws://<host>:'+PORT+'/ws');
  console.log('  ────────────────────────────────────────────────');
  console.log('  Ctrl+C para desligar.');
});

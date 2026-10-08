# 🧬 Tm3d · DApp de Soberania Clínica — Φgital m3d.pro

> **Para todo mundo:** este pacote instala, com **um comando**, o cofre digital de saúde Tm3d no seu servidor — mais um **plugin de Firefox** que se conecta à mesma rede e se pareia por **QR Code**. Nada de tokens longos: um código de 6 dígitos e pronto.
>
> **Para devs:** Node.js puro (zero deps) servindo um DApp single-file com WebCrypto real (AES-256-GCM + ECDSA/ECDH P-256), rede local simulada `tm3d-local-sim` (chainid 79999) com PoW ilustrativo, e relê WebSocket RFC 6455 entre a aba do DApp e a extensão (MV2, Firefox ≥ 109).

---

## 🌱 Camada 1 — Para humanos (sem tecniquês)

### O que é isso?
Um **cofre de exames e laudos que é só seu**. Os arquivos são trancados com criptografia **dentro do seu navegador** antes de irem para qualquer lugar. Na "rede" ficam apenas etiquetas e permissões — nunca o conteúdo. Você decide **quem vê, o quê e por quanto tempo**, e pode revogar com um toque.

### Instalar no servidor (1 comando)
```bash
cd tm3d
bash install.sh        # ou: node server.js
```
Abra no navegador: **http://localhost:8791** 🎉

### Instalar o plugin no Firefox (2 minutos)
1. No Firefox, digite na barra de endereço: `about:debugging#/runtime/this-firefox`
2. Clique em **"Carregar extensão temporária…"**
3. Escolha o arquivo **`extension/manifest.json`** deste pacote.
4. O ícone 🧬 aparece na barra do navegador.

> Para instalação permanente, empacote a pasta `extension/` e assine em [addons.mozilla.org](https://addons.mozilla.org/developers/) — ou use `web-ext build`.

### Parear DApp ⇄ extensão (por QR, sem códigos chatos)
1. No DApp, clique em **📱 Gerar QR de pareamento**.
2. Na extensão, toque em **📷 Ler QR** (ou digite o **código de 6 dígitos**).
3. Pronto — seus registros aparecem na extensão e abrem decifrados **só naquela aba**.

### Teste guiado em 2 minutos
1. Clique em **✨ Carregar demonstração** (cria 1 DNFT, 3 registros cifrados, 2 consentimentos).
2. Vá em **🩺 Sessão do Médico**, escolha *Dra. Helena* + *Prontuários* → **acesso concedido** → decifre um laudo.
3. Troque para *Dr. Rafael* + *Prontuários* → **ACESSO NEGADO** (ele só tem Imagens) — e veja o evento na **🧾 Auditoria**.
4. Em **🤝 Consentimento**, revogue a Dra. Helena e repita o passo 2 → o acesso cai na hora.
5. No **🗂 Cofre**, use **🗑 direito de eliminação** num registro: ele vira matematicamente indecifrável (crypto-shredding, LGPD art. 18).

### ⚠️ Aviso honesto
Ambiente de **demonstração**: a rede é simulada localmente e a re-cifragem de proxy é ilustrativa. **Não use dados de saúde reais.** A criptografia em si é de verdade (WebCrypto do navegador).

---

## 🔬 Camada 2 — Mergulho técnico

### Arquitetura
```
┌─ Servidor remoto ─────────────────────────────────────────┐
│  server.js (Node puro)                                     │
│   ├─ HTTP estático → public/index.html (DApp single-file)  │
│   └─ WS /ws (RFC 6455 hand-rolled) → relê role=web ⇄ ext   │
└──────────────┬──────────────────────────────┬─────────────┘
        HTTP+WS│                              │WS
   ┌───────────▼──────────┐        ┌──────────▼─────────────┐
   │ DApp (aba do browser) │        │ Extensão Firefox (MV2) │
   │ · WebCrypto real      │        │ · popup + background   │
   │ · cadeia simulada PoW │        │ · decifra via chave de │
   │ · QR de pareamento    │        │   sessão (código 6d)   │
   └───────────────────────┘        └────────────────────────┘
```

### Protocolo de pareamento (sem tokens extensos)
1. DApp gera `code` de 6 dígitos; QR carrega `tm3d://pair?ws=<ws://host>&code=<6d>`.
2. Extensão conecta `ws://host/ws?role=ext` e envia `{type:'pair', code}`; o relê encaminha à aba `role=web`, que valida o código.
3. A chave de sessão é `AES-GCM(SHA-256("TM3D-PAIR-"+code))` — o próprio código curto **é** o segredo de pareamento. O DApp decifra o registro com a DK local e o re-cifra sob essa chave só para a extensão.
4. O código expira em 10 minutos e vale 1 sessão.

### Modelo de dados (espelha o descritivo v3.0)
| Conceito do documento | Implementação aqui |
|---|---|
| HealthDNFT (ERC-5192 soulbound) | `tokenId` único por instalação; evento `DNFTMinted` |
| ConsentRegistry (grant/revoke + TTL ≤ 24h) | `grants[]` com expiração automática e revogação 1-clique; assinatura ECDSA P-256 ≈ EIP-712 |
| RecordRegistry (append-only de ponteiros) | `docs[]` com `digest = keccak-like(SHA-256)(ciphertext)` e CID estilo `bafy…` |
| Off-chain cifrado | AES-256-GCM por documento; DK embrulhada via ECDH→AES-GCM |
| Proxy Re-encryption (TACo/Lit) | **simulada**: re-embrulho local para a chave do médico |
| Auditoria | eventos `RecordAppended`, `ConsentGranted/Revoked`, `AccessEvaluated/Granted/Denied`, `KeyShredded` + blocos PoW (prefixo `00`), exportáveis em JSON |
| LGPD art. 18 | crypto-shredding: destruir a DK torna o ciphertext irrecuperável |

### Mensagens do relê WS
| tipo | origem → destino | função |
|---|---|---|
| `pair {code}` | ext → web | pedido de pareamento |
| `recs […]` | web → ext | catálogo (só metadados) |
| `req {recId}` | ext → web | pedido de abertura |
| `rec {iv,ct,…}` | web → ext | conteúdo re-cifrado p/ a sessão |
| `rec-denied` | web → ext | registro eliminado/expirado |

### Arquivos
```
tm3d/
├── server.js            # HTTP estático + relê WS (zero deps)
├── install.sh           # instalação guiada (systemd opcional)
├── public/index.html    # DApp completo (HTML+CSS+JS+QR inline)
├── extension/           # plugin Firefox MV2
│   ├── manifest.json · background.js · popup.html · popup.js · jsQR.js · icon.svg
└── README.md
```

### Endurecimento para produção (roadmap)
- Trocar a cadeia simulada por deploy real em Polygon Amoy com os contratos Foundry do documento v3.0 (HealthDNFT, ConsentRegistry, RecordRegistry).
- Substituir o relê local por WalletConnect/ERC-4337 (gas patrocinado) e a PRE simulada por TACo/Lit.
- Chaves fora do localStorage → carteira AA/MPC com social recovery.
- Assinar a extensão na AMO e servir o DApp via HTTPS (WSS).

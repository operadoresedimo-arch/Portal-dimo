/* Central Édimo: base local SEM conexão, SEM disparos e SEM credenciais.
 * No backend futuro, a regra de envio deve ser atômica, por número, entre todas
 * as operadoras. O navegador nunca será responsável por autorizar/disparar a fila.
 * Contatos importados e rascunhos NÃO são gravados no armazenamento do navegador.
 */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const S={tab:new URLSearchParams(location.search).get('trabalho')==='1'?'apoio':'chat',demo:false,thread:0,drafts:{},book:null,sheet:'',file:'',head:0,rows:[],name:-1,phone:-1,size:20,lots:[],lot:0,lotPage:0,contacts:[],stats:null,campaigns:[],notice:'',error:'',busy:false,sim:{quality:'YELLOW',age:'0',count:'0',gap:'180'}};
 const examples=[
  {name:'Contato exemplo A',last:'Olá! Pode me ajudar?',messages:[{out:false,t:'Olá! Pode me ajudar?'},{out:true,t:'Olá! Como posso ajudar você hoje?'}]},
  {name:'Contato exemplo B',last:'Obrigada pelo retorno.',messages:[{out:false,t:'Obrigada pelo retorno.'}]}
 ];
 function owner(){return typeof cU!=='undefined'&&cU?String(cU.login||cU.nome||''):''}
 let activeOwner='';
 function guard(ctx,now){
  now=now||Date.now();
  if(!ctx.connected)return {ok:false,reason:'Sem conexão com a Meta',code:'OFFLINE'};
  if(!Number.isFinite(ctx.qualityAt)||ctx.qualityAt>now||now-ctx.qualityAt>120000)return {ok:false,reason:'Leitura de qualidade ausente ou expirada',code:'STALE'};
  if(ctx.quality!=='GREEN')return {ok:false,reason:ctx.quality==='YELLOW'?'Qualidade laranja: disparos suspensos':ctx.quality==='RED'?'Qualidade vermelha: disparos suspensos':'Qualidade desconhecida: disparos suspensos',code:'QUALITY'};
  const attempts=(ctx.attempts||[]).filter(t=>Number.isFinite(t)&&t>now-3600000&&t<=now);
  if(attempts.length>=20)return {ok:false,reason:'Limite de 20 mensagens nos últimos 60 minutos',code:'HOURLY',wait:Math.max(1,Math.ceil((Math.min.apply(null,attempts)+3600000-now)/1000))};
  if(Number.isFinite(ctx.lastAttempt)&&now-ctx.lastAttempt<120000)return {ok:false,reason:'Aguardar intervalo mínimo de 2 minutos',code:'INTERVAL',wait:Math.max(1,Math.ceil((120000-now+ctx.lastAttempt)/1000))};
  return {ok:true,reason:'Permitido pela regra de qualidade e ritmo',code:'READY'};
 }
 function btn(text,action,cls,disabled){return '<button type="button" class="ec-btn '+(cls||'')+'" data-ec="'+action+'"'+(disabled?' disabled':'')+'>'+text+'</button>'}
 function notice(msg,error){S.error=error?msg:'';S.notice=error?'':msg;render()}
 function health(){return '<div class="ec-health"><div><span class="ec-light" aria-hidden="true"></span><b>Qualidade não consultada</b><small>Sem conexão com a Meta</small></div><div><small>Até 20/h · intervalo mínimo de 2 min</small>'+btn('Ver regras','tab:numeros','link')+'</div></div>'}
 function mount(){
  const pg=$('pageTrabalho');if(!pg)return;
  const who=owner();
  const changed=activeOwner&&activeOwner!==who;
  if(changed){
   S.book=null;S.rows=[];S.contacts=[];S.lots=[];S.campaigns=[];S.drafts={};S.stats=null;S.file='';S.demo=false;S.notice='';S.error='';
  }
  activeOwner=who;
  if($('edCentral')){if(changed)render();return}
  const old=document.createElement('div');old.id='atApoio';
  while(pg.firstChild)old.appendChild(pg.firstChild);
  const shell=document.createElement('div');shell.id='edCentral';shell.className='edc';
  shell.innerHTML='<header class="ec-head"><div><h2>Área de Trabalho</h2><p>Conversas, planilhas e campanhas em um só lugar.</p></div><span class="ec-badge"><i class="ec-light"></i>Base sem conexão</span></header><div id="ecHealth"></div><nav class="ec-nav" role="tablist" aria-label="Área de Trabalho">'+[['chat','Conversas'],['planilhas','Planilhas'],['campanhas','Campanhas'],['numeros','Números e qualidade'],['apoio','Apoio à ligação']].map(t=>'<button type="button" id="ecTab_'+t[0]+'" role="tab" aria-controls="'+(t[0]==='apoio'?'atApoio':'ecContent')+'" aria-selected="false" data-ec="tab:'+t[0]+'">'+t[1]+'</button>').join('')+'</nav><div id="ecAlerts" aria-live="polite"></div><section id="ecContent" role="tabpanel"></section><p class="ec-local">Base local, sem envios reais. Importações, lotes e rascunhos ficam só nesta aba e se perdem ao atualizar. Histórico compartilhado e integração com a Meta ainda não estão conectados.</p>';
  shell.insertBefore(old,shell.querySelector('.ec-local'));pg.appendChild(shell);
  shell.addEventListener('click',click);
  shell.addEventListener('change',change);
  shell.addEventListener('input',input);
  shell.addEventListener('keydown',e=>{
   if(!e.target.matches('.ec-nav [role=tab]')||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
   e.preventDefault();const tabs=Array.from(shell.querySelectorAll('.ec-nav button'));let i=tabs.indexOf(e.target);i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length;tab(tabs[i].dataset.ec.split(':')[1]);tabs[i].focus();
  });
  render();
 }
 function render(){
  if(!$('edCentral'))return;
  $('ecHealth').innerHTML=health();
  $('ecAlerts').innerHTML=S.error?'<div class="ec-error" role="alert">'+esc(S.error)+'</div>':S.notice?'<div class="ec-notice">'+esc(S.notice)+'</div>':'';
  document.querySelectorAll('#edCentral .ec-nav button').forEach(b=>{const on=b.dataset.ec==='tab:'+S.tab;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1});
  $('atApoio').hidden=S.tab!=='apoio';
  $('ecContent').hidden=S.tab==='apoio';$('ecContent').setAttribute('aria-labelledby','ecTab_'+S.tab);
  if(S.tab!=='apoio')$('ecContent').innerHTML=({chat:chat,planilhas:spreadsheets,campanhas:campaigns,numeros:numbers}[S.tab]||chat)();
 }
 function tab(t){S.tab=t;S.error='';S.notice='';render()}
 function chat(){
  if(!S.demo)return '<div class="ec-chat"><aside class="ec-inbox"><div><b>Conversas</b></div><input class="ec-search" placeholder="Buscar conversa" disabled aria-label="Buscar conversa"><p class="ec-note">As conversas aparecerão aqui depois de conectar o servidor.</p></aside><div class="ec-conversation"><div class="ec-empty"><div class="ec-mark" aria-hidden="true">◌</div><b>Seu atendimento, aqui.</b><p>Escolha uma conversa para ver o histórico e responder.<br>Nenhuma mensagem está sendo recebida ou enviada nesta base.</p>'+btn('Ver demonstração do chat','demo','primary')+'</div><div class="ec-compose"><textarea disabled placeholder="Conecte o servidor para responder." aria-label="Mensagem"></textarea><div class="ec-row ec-between"><span class="ec-muted">Envio indisponível</span>'+btn('Enviar','offline','primary',true)+'</div></div></div><aside class="ec-contact"><b>Dados do contato</b><p class="ec-note">Nome, telefone, responsável, lote e situação do atendimento.</p></aside></div>';
  const c=examples[S.thread];
  return '<div class="ec-demo-banner"><span><b>Demonstração</b> · Contatos fictícios. Não envia WhatsApp.</span>'+btn('Sair da demonstração','demo','small')+'</div><div class="ec-chat"><aside class="ec-inbox"><div><b>Conversas de exemplo</b></div>'+examples.map((t,i)=>'<button type="button" data-ec="thread:'+i+'" class="ec-thread '+(S.thread===i?'on':'')+'"><b>'+t.name+'</b><span>'+t.last+'</span></button>').join('')+'</aside><div class="ec-conversation"><div class="ec-conv-head"><b>'+c.name+'</b><span class="ec-muted">Fictício</span></div><div class="ec-messages" id="ecMessages">'+c.messages.map(m=>'<div class="ec-bubble '+(m.out?'out':'')+'">'+esc(m.t)+'<small>Exemplo local · não enviado</small></div>').join('')+'</div><div class="ec-compose"><textarea id="ecDraft" maxlength="2000" placeholder="Teste uma resposta fictícia..." aria-label="Resposta de demonstração">'+esc(S.drafts[S.thread]||'')+'</textarea><div class="ec-row ec-between"><span class="ec-muted">Somente simulação</span>'+btn('Adicionar à simulação','draft','primary')+'</div></div></div><aside class="ec-contact"><b>'+c.name+'</b><dl><dt>Telefone</dt><dd>Não cadastrado (exemplo)</dd><dt>Responsável</dt><dd>Operadora de demonstração</dd><dt>Origem</dt><dd>Conversa fictícia</dd><dt>WhatsApp</dt><dd>Sem conexão</dd></dl></aside></div>';
 }
 function options(cols,selected,none){return (none?'<option value="-1">Selecione...</option>':'')+cols.map((c,i)=>'<option value="'+i+'"'+(i===selected?' selected':'')+'>'+esc(c||'Coluna '+(i+1))+'</option>').join('')}
 function spreadsheets(){
  const head=S.rows[S.head]||[];
  let h='<div class="ec-grid"><div class="ec-panel"><h3>Adicionar planilha</h3><p class="ec-muted">Excel ou CSV. Confira os campos antes de criar os lotes.</p><label class="ec-upload"><b>'+(S.busy?'Lendo arquivo…':'Escolha a planilha das meninas')+'</b><span>Arquivo lido só nesta aba, sem envio para terceiros.</span><input id="ecFile" type="file" accept=".xlsx,.xls,.csv"'+(S.busy?' disabled':'')+'></label>';
  if(S.file)h+='<p><b>'+esc(S.file)+'</b></p><div class="ec-fields" style="margin-top:14px"><label class="ec-field"><span>Aba da planilha</span><select id="ecSheet">'+S.book.SheetNames.map(n=>'<option'+(n===S.sheet?' selected':'')+'>'+esc(n)+'</option>').join('')+'</select></label><label class="ec-field"><span>Linha dos títulos</span><select id="ecHead">'+S.rows.slice(0,Math.min(10,S.rows.length)).map((r,i)=>'<option value="'+i+'"'+(S.head===i?' selected':'')+'>Linha '+(i+1)+': '+esc(r.slice(0,3).join(' · ').slice(0,75))+'</option>').join('')+'</select></label><label class="ec-field"><span>Nome do contato</span><select id="ecName">'+options(head,S.name,true)+'</select></label><label class="ec-field"><span>Telefone / WhatsApp</span><select id="ecPhone">'+options(head,S.phone,true)+'</select></label><label class="ec-field"><span>Contatos por lote</span><input id="ecSize" type="number" min="1" max="500" value="'+S.size+'"></label></div>'+btn('Conferir e criar lotes locais','build','primary',S.name<0||S.phone<0||S.name===S.phone)+'<p class="ec-note">Remove telefones repetidos e separa linhas inválidas. CPF nunca é usado como telefone automaticamente.</p>';
  h+='</div><div class="ec-panel"><h3>Prévia da planilha</h3><p class="ec-muted">Dados do arquivo original. Até 8 linhas e 6 colunas.</p>';
  if(head.length)h+=table(head.slice(0,6),S.rows.slice(S.head+1,S.head+9).map(r=>head.slice(0,6).map((_,i)=>r[i]||'')));
  else h+='<div class="ec-empty"><div class="ec-mark">▦</div><b>Confira antes de usar.</b><p>Os nomes das colunas e as primeiras linhas aparecem aqui.</p></div>';
  h+='</div></div>';
  if(S.stats)h+='<div class="ec-panel" style="margin-top:16px"><div class="ec-row ec-between"><div><h3>Lotes desta aba</h3><p class="ec-muted">'+S.stats.valid+' contatos válidos · '+S.stats.dup+' repetidos · '+S.stats.invalid+' linhas inválidas · '+S.lots.length+' lotes</p></div>'+btn('Preparar campanha','tab:campanhas','primary',!S.lots.length)+'</div>'+lotsTable()+(S.lots.length?'<h4>Prévia do lote '+(S.lot+1)+'</h4>'+table(['Telefone','Primeiro nome'],S.lots[S.lot].slice(0,10).map(c=>[c.phone,c.first]))+'<p class="ec-note">CSV: telefone com 55 e primeiro nome, sem cabeçalho. Nenhum lote é enviado automaticamente. Validade do número não comprova WhatsApp ativo ou autorização de contato.</p>':'')+'</div>';
  return h;
 }
 function table(head,rows){return '<div class="ec-table-wrap"><table class="ec-table"><thead><tr>'+head.map(c=>'<th scope="col">'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+esc(String(c).slice(0,250))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}
 function lotsTable(){
  const start=S.lotPage*10;
  return '<div class="ec-table-wrap"><table class="ec-table"><thead><tr><th>Lote</th><th>Contatos</th><th>Estado</th><th>Ações</th></tr></thead><tbody>'+S.lots.slice(start,start+10).map((l,j)=>{const i=start+j;return '<tr class="'+(S.lot===i?'active':'')+'"><td>Lote '+String(i+1).padStart(3,'0')+'</td><td>'+l.length+'</td><td>Local, não enviado</td><td>'+btn('Ver','lot:'+i,'small')+' '+btn('Baixar CSV','csv:'+i,'small')+'</td></tr>'}).join('')+'</tbody></table></div><div class="ec-row ec-between"><span class="ec-muted">'+(S.lots.length?'Lotes '+(start+1)+' a '+Math.min(start+10,S.lots.length):'Nenhum lote')+'</span><div class="ec-row">'+btn('Anterior','page:-1','small',!S.lotPage)+btn('Próximos','page:1','small',start+10>=S.lots.length)+'</div></div>';
 }
 function campaigns(){
  return '<div class="ec-grid"><div class="ec-panel"><h3>Preparar campanha</h3><p class="ec-muted">Organize o trabalho. O disparo permanece bloqueado nesta base.</p><div style="margin-top:16px"><label class="ec-field"><span>Nome da campanha</span><input id="ecCampaignName" maxlength="100" placeholder="Ex.: Atendimento da tarde"></label><label class="ec-field"><span>Lote desta aba</span><select id="ecCampaignLot"><option value="-1">Selecione...</option>'+S.lots.map((l,i)=>'<option value="'+i+'">Lote '+(i+1)+' · '+l.length+' contatos</option>').join('')+'</select></label><label class="ec-field"><span>Número de envio</span><select disabled><option>Aguardando conexão com a Meta</option></select></label><label class="ec-field"><span>Modelo de mensagem</span><select disabled><option>Aguardando modelos aprovados da conta</option></select></label></div><div class="ec-row">'+btn('Salvar rascunho local','campaign','primary',!S.lots.length)+btn('Iniciar disparos','offline','',true)+'</div>'+(!S.lots.length?'<p class="ec-note">Adicione uma planilha na aba Planilhas para preparar o primeiro lote.</p>':'')+'</div><div class="ec-panel"><h3>Proteções da fila</h3><ul class="ec-settings"><li>Qualidade verde e leitura recente para liberar.</li><li>Laranja, vermelho, desconhecido ou erro de consulta: suspender os próximos disparos.</li><li>Intervalo mínimo de 2 minutos por número.</li><li>Máximo de 20 envios em uma janela móvel de 60 minutos, somando todas as operadoras.</li><li>Após recuperar o verde, respeitar o tempo e o limite que ainda restam.</li><li>Modelo aprovado, conta apta e autorização de contato continuam necessários.</li></ul><p class="ec-note">Mensagens já entregues à Meta não podem ser canceladas por essa pausa. O backend futuro precisará controlar a fila mesmo com o portal fechado.</p>'+btn('Ver teste do semáforo','tab:numeros','link')+'</div></div><div class="ec-panel" style="margin-top:16px"><h3>Rascunhos de campanha</h3>'+(S.campaigns.length?table(['Campanha','Lote','Contatos','Situação','Enviados'],S.campaigns.map(c=>[c.name,'Lote '+(c.lot+1),c.count,'Bloqueada: sem conexão',0])):'<p class="ec-muted">Nenhuma campanha preparada nesta aba.</p>')+'</div>';
 }
 function numbers(){
  const x=S.sim,now=Date.now(),r=guard({connected:true,quality:x.quality,qualityAt:now-Number(x.age)*1000,attempts:Array.from({length:Math.min(20,Math.max(0,Number(x.count)||0))},(_,i)=>now-180000-i*120000),lastAttempt:now-Number(x.gap)*1000},now);
  return '<div class="ec-grid"><div class="ec-panel"><h3>Número de WhatsApp</h3><p class="ec-muted">Não existe número conectado nesta base.</p><div class="ec-legend"><span><i class="ec-light green"></i>Verde: apto pela qualidade</span><span><i class="ec-light yellow"></i>Laranja: pausar</span><span><i class="ec-light red"></i>Vermelho: pausar</span></div>'+table(['Indicador','Leitura real'],[['Número','Não conectado'],['Qualidade de mensagens','Não consultada'],['Última consulta','Ainda não realizada'],['Fila de disparos','Bloqueada'],['Enviadas nesta base','0']])+'<p class="ec-note">A cor deve vir da API da Meta, nunca da escolha de uma operadora. O painel usa laranja para o estado YELLOW da API. Qualidade de mensagens não é a mesma métrica que qualidade de chamadas.</p></div><div class="ec-panel"><h3>Testar a regra de suspensão</h3><p class="ec-muted">Simulador isolado. Não muda o número real nem envia mensagens.</p><div class="ec-fields" style="margin-top:16px"><label class="ec-field"><span>Cor simulada</span><select id="ecSimQuality">'+[['GREEN','Verde'],['YELLOW','Laranja'],['RED','Vermelho'],['UNKNOWN','Desconhecida']].map(t=>'<option value="'+t[0]+'"'+(x.quality===t[0]?' selected':'')+'>'+t[1]+'</option>').join('')+'</select></label><label class="ec-field"><span>Idade da consulta simulada</span><select id="ecSimAge"><option value="0"'+(x.age==='0'?' selected':'')+'>Agora</option><option value="180"'+(x.age==='180'?' selected':'')+'>Há 3 minutos (expirada)</option></select></label><label class="ec-field"><span>Envios na última hora</span><select id="ecSimCount">'+['0','10','19','20'].map(n=>'<option'+(x.count===n?' selected':'')+'>'+n+'</option>').join('')+'</select></label><label class="ec-field"><span>Tempo desde o último envio</span><select id="ecSimGap"><option value="180"'+(x.gap==='180'?' selected':'')+'>3 minutos</option><option value="30"'+(x.gap==='30'?' selected':'')+'>30 segundos</option></select></label></div><div class="ec-result '+(r.ok?'ready':'blocked')+'" aria-live="polite"><b>'+esc(r.ok?'Simulação: qualidade e ritmo permitem':'Simulação: suspenso')+'</b><p>'+esc(r.reason)+(r.wait?' · aguardar pelo menos '+r.wait+' segundos':'')+'</p></div><p class="ec-note">Leitura com mais de 2 minutos é tratada como expirada nesta regra inicial. O indicador real acima continua sem conexão.</p></div></div><div class="ec-panel" style="margin-top:16px"><h3>O que falta conectar no servidor</h3><p class="ec-muted">Credenciais protegidas, qualidade oficial de mensagens, situação da conta e dos modelos, recebimento de webhooks, histórico compartilhado, bloqueios e descadastros, fila por número e auditoria de cada tentativa. Não colocar token da Meta no index.html.</p></div>';
 }
 function telephone(v){
  let d=String(v||'').replace(/\D/g,'');
  if((d.length===12||d.length===13)&&d.startsWith('55'))d=d.slice(2);
  if(!/^[1-9]\d{9,10}$/.test(d)||/^(\d)\1+$/.test(d))return '';
  return '55'+d;
 }
 function loadSheet(name){
  const ws=S.book.Sheets[name];if(!ws)throw Error('Aba não encontrada.');
  const range=XLSX.utils.decode_range(ws['!ref']||'A1');
  if(range.e.r>50000||range.e.c>=200||(range.e.r+1)*(range.e.c+1)>1000000)throw Error('Esta aba é grande demais para a base local. Use até 50 mil linhas, 200 colunas e 1 milhão de células.');
  S.sheet=name;S.rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:'',blankrows:false});S.head=0;detect();invalidateLots();
 }
 function detect(){const h=S.rows[S.head]||[];S.name=h.findIndex(v=>/^(nome|cliente|devedor|contato|razao social|nome completo|name)(\b|_)/.test(norm(v)));S.phone=h.findIndex(v=>/(whats|telefone|celular|fone|phone)/.test(norm(v)))}
 function invalidateLots(){S.lots=[];S.contacts=[];S.stats=null;S.campaigns=[];S.lot=0;S.lotPage=0}
 async function importFile(file){
  if(!file)return;
  if(!/\.(xlsx|xls|csv)$/i.test(file.name)){notice('Use um arquivo Excel ou CSV.',true);return}
  if(file.size>8*1024*1024){notice('Para esta base local, use arquivos de até 8 MB.',true);return}
  if(!window.XLSX){notice('O leitor de planilhas ainda não carregou. Aguarde ou confira o acesso ao CDN.',true);return}
  S.busy=true;S.error='';S.notice='';render();
  try{const data=await file.arrayBuffer();const book=XLSX.read(data,{type:'array',cellFormula:false,cellHTML:false});if(!book.SheetNames.length)throw Error('O arquivo não tem abas.');S.book=book;loadSheet(book.SheetNames[0]);S.file=file.name;S.demo=false}
  catch(e){S.book=null;S.rows=[];S.file='';invalidateLots();S.error='Não foi possível abrir: '+e.message}
  finally{S.busy=false;render()}
 }
 function build(){
  if(S.name<0||S.phone<0||S.name===S.phone){notice('Selecione colunas diferentes para nome e telefone.',true);return}
  const size=Number($('ecSize').value);if(!Number.isInteger(size)||size<1||size>500){notice('Use entre 1 e 500 contatos por lote.',true);return}S.size=size;
  const stats={valid:0,dup:0,invalid:0},seen=new Set(),contacts=[];
  S.rows.slice(S.head+1).forEach(r=>{if(!r.some(v=>String(v).trim()))return;const name=String(r[S.name]||'').trim(),phone=telephone(r[S.phone]);if(!phone||!name){stats.invalid++;return}if(seen.has(phone)){stats.dup++;return}seen.add(phone);contacts.push({phone,name,first:name.split(/\s+/)[0]});stats.valid++});
  invalidateLots();S.contacts=contacts;S.stats=stats;
  for(let i=0;i<contacts.length;i+=size)S.lots.push(contacts.slice(i,i+size));
  S.notice='Conferência concluída. Os lotes existem só nesta aba; baixe os CSVs para guardar.';S.error='';render();
 }
 function csvCell(v){let s=String(v);if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
 function csv(i){
  if(!S.lots[i])return;
  const blob=new Blob([S.lots[i].map(c=>[c.phone,c.first].map(csvCell).join(',')).join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Edimo_Lote_'+String(i+1).padStart(3,'0')+'_'+S.lots[i].length+'_contatos.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
 }
 function click(e){
  const b=e.target.closest('[data-ec]');if(!b||b.disabled)return;
  const [a,v]=b.dataset.ec.split(':');
  if(a==='tab'){tab(v);return}
  if(a==='demo'){S.demo=!S.demo;render()}
  if(a==='thread'){S.thread=Number(v);render()}
  if(a==='draft'){const t=String($('ecDraft').value||'').trim();if(!t)return;examples[S.thread].messages.push({out:true,t:t.slice(0,2000)});S.drafts[S.thread]='';render();$('ecMessages').scrollTop=$('ecMessages').scrollHeight;$('ecDraft').focus()}
  if(a==='build')build();
  if(a==='lot'){S.lot=Number(v);render()}
  if(a==='page'){S.lotPage+=Number(v);render()}
  if(a==='csv')csv(Number(v));
  if(a==='campaign'){
   const name=$('ecCampaignName').value.trim(),lot=Number($('ecCampaignLot').value);
   if(!name||!S.lots[lot]){notice('Dê um nome à campanha e selecione um lote.',true);return}
   S.campaigns.push({name,lot,count:S.lots[lot].length});notice('Rascunho salvo apenas nesta aba. Nenhuma mensagem foi enviada.');
  }
 }
 function input(e){if(e.target.id==='ecDraft')S.drafts[S.thread]=e.target.value}
 function change(e){
  const id=e.target.id,v=e.target.value;
  if(id==='ecFile'){importFile(e.target.files[0]);return}
  if(id==='ecSheet'){try{loadSheet(v);S.error=''}catch(err){S.error=err.message}render();return}
  if(id==='ecHead'){S.head=Number(v);detect();invalidateLots();render();return}
  if(id==='ecName'||id==='ecPhone'){S[id==='ecName'?'name':'phone']=Number(v);invalidateLots();render();return}
  if(id==='ecSize')S.size=Number(v);
  const fields={ecSimQuality:'quality',ecSimAge:'age',ecSimCount:'count',ecSimGap:'gap'};
  if(fields[id]){S.sim[fields[id]]=v;render();$(id).focus()}
 }
 window.EDCentral={mount,rules:{guard,telephone}};
})();

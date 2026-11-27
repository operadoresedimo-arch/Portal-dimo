/* CRM OPERADOR (piloto) - area de trabalho da cobranca, no estilo da Prospeccao.
 * Usa SO o que o portal ja tem: banco de dados (banco_info / banco_buscar) e as abas CRM_ do Script Ponto
 * (tab_listar / tab_salvar). Sem API do Cobmais: a situacao vem da ultima planilha importada.
 * Atendimentos: aba CRM_Atendimentos (planilha Ponto edimo). Se a aba nao existir ou o servidor recusar,
 * grava neste computador e mostra o aviso. Nada daqui grava no Cobmais nem dispara mensagem.
 */
(function(){
'use strict';
var ABA='CRM_Atendimentos';
var CAMPOS=['data','operador','cpf_cnpj','cliente','credor','contrato','canal','resultado','retorno','valor','obs','feito'];
var RESULT=[
 ['promessa','Promessa de pagamento','#16a34a',1],
 ['acordo','Acordo fechado no Cobmais','#0f3557',0],
 ['retornar','Pediu para retornar','#2563eb',1],
 ['negociando','Atendeu, sem acordo','#b8901f',1],
 ['pagou','Diz que já pagou (conferir)','#7c3aed',0],
 ['recado','Recado ou terceiro','#0891b2',1],
 ['nao_atende','Não atende / caixa postal','#64748b',1],
 ['numero_errado','Número errado','#9ca3af',0],
 ['recusa','Recusa / sem condição','#b91c1c',1]];
var RES={};RESULT.forEach(function(r){RES[r[0]]={t:r[1],c:r[2],ret:r[3]}});
var CANAIS=['Ligação','WhatsApp','Receptivo','E-mail','Presencial'];

var C={view:'dia',info:null,infoErr:'',infoCarreg:false,q:'',busc:false,res:null,resErr:'',cli:null,sel:{},
  sim:{multa:'2',juros:'1',entrada:'',parc:'3'},at:null,atErr:'',atCarreg:false,modo:'',equipe:false,
  fAg:'atras',fHist:'',form:null,msg:'',salvando:false};
var EL=null;

function $(i){return document.getElementById(i)}
function esc(t){return String(t==null?'':t).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function nz(t){return String(t==null?'':t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()}
function p2(n){return('0'+n).slice(-2)}
function hojeIso(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())}
function addDias(n){var d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())}
function br(v){var m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:String(v==null?'':v)}
function agoraLocal(){var d=new Date();return hojeIso()+'T'+p2(d.getHours())+':'+p2(d.getMinutes())+':'+p2(d.getSeconds())}
// a planilha pode devolver data como texto ISO com Z: volta para o horario/dia local
function normData(v){v=String(v||'');if(!/T.*(Z|[+-]\d\d:?\d\d)$/.test(v))return v;var d=new Date(v);if(isNaN(d))return v;return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())+'T'+p2(d.getHours())+':'+p2(d.getMinutes())+':'+p2(d.getSeconds())}
function normDia(v){v=String(v||'');if(/T/.test(v))return normData(v).slice(0,10);var m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(m)return m[3]+'-'+p2(m[2])+'-'+p2(m[1]);return v.slice(0,10)}
function curtoNome(n){var w=String(n||'').trim().split(/\s+/).filter(function(x){return ['de','da','do','das','dos','e'].indexOf(x.toLowerCase())<0});return tit(w.length>1?w[0]+' '+w[w.length-1]:(w[0]||'Ficha'))}
function hora(v){var d=new Date(v);return isNaN(d)?'':p2(d.getHours())+':'+p2(d.getMinutes())}
function eu(){return (typeof cU!=='undefined'&&cU)?String(cU.login||cU.nome||'').trim().toLowerCase().replace(/^\d+\./,''):''}
function euNome(){var n=(typeof cU!=='undefined'&&cU&&cU.nome)?String(cU.nome):eu();n=n.trim().split(/\s+/)[0]||'';return n.charAt(0).toUpperCase()+n.slice(1).toLowerCase()}
function lider(){var p=(typeof cU!=='undefined'&&cU)?String(cU.papel||cU.perfil||''):'';return p==='admin'||p==='lider'}
function tokGet(){try{var t=JSON.parse(localStorage.getItem('mq_tok')||'null');return t&&t.k===eu()?t.t:''}catch(e){return ''}}
function tokSet(t){try{localStorage.setItem('mq_tok',JSON.stringify({k:eu(),t:t}))}catch(e){}}
function url(){return (typeof SCRIPT_URL!=='undefined'&&SCRIPT_URL)||''}
function post(b){return fetch(url(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(b)}).then(function(r){return r.json()})}
function api(b){b.type='crm';b.login=eu();b.token=tokGet();return post(b).then(function(j){
  if(j.status!=='ok'){if(j.relogin){try{localStorage.removeItem('mq_tok')}catch(e){}var e=new Error('senha');e.relogin=1;throw e}throw new Error(j.msg||'erro')}
  if(j.token)tokSet(j.token);return j})}
function toast(t){var x=$('coToast');if(!x){x=document.createElement('div');x.id='coToast';document.body.appendChild(x)}x.textContent=t;x.className='on';clearTimeout(x._t);x._t=setTimeout(function(){x.className=''},2800)}
function numDe(v){if(v===''||v==null)return null;if(typeof v==='number')return v;var s=String(v).replace(/[R$\s]/g,'');if(!s)return null;
  if(s.indexOf(',')>=0)s=s.replace(/\./g,'').replace(',','.');var n=Number(s);return isNaN(n)?null:n}
function money(n){n=+n||0;return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function soDig(v){return String(v||'').replace(/\D/g,'')}
function docNorm(v){var d=soDig(v);if(!d)return '';if(d.length<=11)return ('00000000000'+d).slice(-11);if(d.length<14)return ('00000000000000'+d).slice(-14);return d}
function docFmt(v){var d=docNorm(v);if(d.length===11)return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4');if(d.length===14)return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');return d}
function telFmt(v){var d=soDig(v).replace(/^55(?=\d{10,11}$)/,'');if(d.length===11)return '('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7);if(d.length===10)return '('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6);return String(v||'')}
function tit(n){return String(n||'').toLowerCase().split(/\s+/).filter(Boolean).map(function(w){return ['de','da','do','das','dos','e'].indexOf(w)>=0?w:w.charAt(0).toUpperCase()+w.slice(1)}).join(' ')}
// datas da planilha: dd/mm/aaaa, dd/mm/aa ou aaaa-mm-dd
function dataDe(v){v=String(v||'').trim();var m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);
  m=v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(m){var a=+m[3];if(a<100)a+=2000;return new Date(a,+m[2]-1,+m[1])}return null}
function atraso(v){var d=dataDe(v);if(!d)return null;var h=new Date();h.setHours(0,0,0,0);return Math.round((h-d)/864e5)}
function diasAte(iso){var d=dataDe(iso);if(!d)return null;var h=new Date();h.setHours(0,0,0,0);return Math.round((d-h)/864e5)}

// ---- colunas do banco: acha pelo nome (cada credor manda de um jeito) ----
function acha(cab,re,nao){for(var i=0;i<cab.length;i++){var k=nz(cab[i]);if(re.test(k)&&!(nao&&nao.test(k)))return i}return -1}
function todas(cab,re,nao){var R=[];cab.forEach(function(c,i){var k=nz(c);if(re.test(k)&&!(nao&&nao.test(k)))R.push(i)});return R}
function mapa(cab){return {
  doc:acha(cab,/cpf|cnpj|documento/),
  nome:acha(cab,/^nome|cliente|devedor|razao|sacado|^devedor/,/credor|mae|pai|conjuge|refer|contato|empresa credora|arquivo/),
  credor:cab.indexOf('credor'),arq:cab.indexOf('arquivo'),imp:cab.indexOf('importado_em'),
  contrato:acha(cab,/contrato/,/data|observ|obs\b|valor|plano/),
  parcela:acha(cab,/parcela/,/observ|obs\b|valor|qtd|quant|total|venc/),
  venc:acha(cab,/venc/),
  valor:acha(cab,/valor|saldo/,/atualiz|corrig|receita|comiss|juros|multa|pago|desconto/),
  atual:acha(cab,/atualiz|corrig/),
  tel:todas(cab,/telefone|celular|fone|whats/,/tipo|obs|status|operadora/),
  email:todas(cab,/e-?mail/),
  end:todas(cab,/endere|logradouro|^rua|bairro|cidade|municipio|^uf$|estado|cep/),
  sit:acha(cab,/situac|status/,/whats|telefone/)}}
function colsBusca(I){var cs=(I&&I.colunas)||[],re=/cpf|cnpj|documento|nome|cliente|devedor|razao|sacado|contrato|parcela|venc|valor|saldo|atualiz|corrig|telefone|celular|fone|whats|e-?mail|endere|logradouro|^rua|bairro|cidade|municipio|^uf$|estado|cep|situac|status|observ|obs\b/;
  return ['credor','arquivo','importado_em'].concat(cs.filter(function(k){return re.test(nz(k))}).slice(0,60))}

// ---- atendimentos: planilha (CRM_Atendimentos) ou este computador ----
function lsKey(){return 'co_at_'+eu()}
function lsLer(){try{var a=JSON.parse(localStorage.getItem(lsKey())||'[]');return Array.isArray(a)?a:[]}catch(e){return []}}
function lsGravar(a){try{localStorage.setItem(lsKey(),JSON.stringify(a.slice(-3000)))}catch(e){toast('Não consegui guardar neste computador')}}
function locais(){return lsLer()}
function carregaAt(forcar){
  if(C.atCarreg)return;if(C.at&&!forcar)return;
  C.atCarreg=true;
  api({acao:'tab_listar',aba:ABA}).then(function(j){C.atCarreg=false;C.modo='planilha';C.atErr='';
    var L=(j.linhas||[]).map(function(r){var o={id:r.id};CAMPOS.forEach(function(k){o[k]=r[k]==null?'':String(r[k])});o.data=normData(o.data);o.retorno=o.retorno?normDia(o.retorno):'';return o});
    C.at=L;render()})
  .catch(function(e){C.atCarreg=false;if(e.relogin){pedeSenha('');return}
    C.modo='local';C.atErr=e.message||'';C.at=[];render()});
}
function lista(){var L=(C.at||[]).slice(),P=locais().filter(function(x){return C.modo!=='planilha'||x.pend});
  L=L.concat(P);var e=eu();if(!(C.equipe&&lider()))L=L.filter(function(x){return String(x.operador||'').toLowerCase()===e});
  return L.sort(function(a,b){return String(b.data).localeCompare(String(a.data))})}
function pendentes(){return locais().filter(function(x){return x.pend})}
function salvarAt(o){
  var loc=function(pend){var a=lsLer();o.id=o.id||('L'+Date.now()+Math.floor(Math.random()*1000));o.pend=pend?1:0;
    var i=a.findIndex(function(x){return x.id===o.id});if(i>=0)a[i]=o;else a.push(o);lsGravar(a)};
  if(C.modo!=='planilha'){loc(0);return Promise.resolve('local')}
  var lin={};CAMPOS.forEach(function(k){lin[k]=o[k]==null?'':o[k]});if(o.id&&String(o.id).charAt(0)!=='L')lin.id=o.id;
  return api({acao:'tab_salvar',aba:ABA,linha:lin}).then(function(j){var r=j.linha||lin;var x={id:r.id};CAMPOS.forEach(function(k){x[k]=r[k]==null?'':String(r[k])});x.data=normData(x.data);x.retorno=x.retorno?normDia(x.retorno):'';
    var i=C.at.findIndex(function(y){return y.id===x.id});if(i>=0)C.at[i]=x;else C.at.push(x);
    if(o.id&&String(o.id).charAt(0)==='L'){lsGravar(lsLer().filter(function(y){return y.id!==o.id}))}
    return 'planilha'})
  .catch(function(e){if(e.relogin)throw e;loc(1);return 'pendente'});
}
function enviarPend(){var P=pendentes();if(!P.length||C.modo!=='planilha')return;var ok=0,i=0;
  (function prox(){if(i>=P.length){toast(ok+' de '+P.length+' enviados para a planilha');render();return}
    salvarAt(P[i++]).then(function(r){if(r==='planilha')ok++;prox()}).catch(function(){prox()})})()}

// ---- banco ----
function carregaInfo(){if(C.info||C.infoCarreg)return;C.infoCarreg=true;
  api({acao:'banco_info'}).then(function(j){C.infoCarreg=false;C.info=j;C.infoErr='';render()})
  .catch(function(e){C.infoCarreg=false;if(e.relogin){pedeSenha('');return}C.infoErr=e.message||'erro';render()})}
function buscar(q,abrirDoc){q=String(q||'').trim();if(!q){toast('Digite nome, CPF ou CNPJ');return}
  if(!C.info){carregaInfo();toast('Carregando o banco, tente de novo em instantes');return}
  var d=soDig(q),termo=(d.length>=11&&d.length===q.replace(/[\s.\-\/]/g,'').length)?docNorm(d):q;
  if(!abrirDoc&&termo===q&&q.length<4){toast('Digite pelo menos 4 letras do nome');return}
  C.q=q;C.busc=true;C.resErr='';C.view='busca';render();
  api({acao:'banco_buscar',credores:[],todos:true,termos:[termo],colunas:colsBusca(C.info),de:'',ate:''})
  .then(function(j){C.busc=false;C.res=agrupa(j);
    if(abrirDoc){var c=C.res.cli.find(function(x){return x.doc===docNorm(abrirDoc)})||(C.res.cli.length===1?C.res.cli[0]:null);if(c){abrirCli(c);return}}
    if(C.res.cli.length===1&&d.length>=11){abrirCli(C.res.cli[0]);return}
    render()})
  .catch(function(e){C.busc=false;if(e.relogin){pedeSenha('');return}C.resErr=e.message||'erro';render()})}
function agrupa(j){var cab=j.cab||[],M=mapa(cab),G={},ord=[];
  (j.linhas||[]).forEach(function(r){var doc=M.doc>=0?docNorm(r[M.doc]):'',nome=M.nome>=0?String(r[M.nome]||'').trim():'';
    var k=doc||('n:'+nz(nome));if(!G[k]){G[k]={doc:doc,nome:nome,linhas:[],cred:{}};ord.push(k)}
    var g=G[k];if(!g.nome&&nome)g.nome=nome;g.linhas.push(r);if(M.credor>=0&&r[M.credor])g.cred[r[M.credor]]=1});
  var cli=ord.map(function(k){var g=G[k];g.total=g.linhas.reduce(function(s,r){return s+(M.valor>=0?(numDe(r[M.valor])||0):0)},0);g.credores=Object.keys(g.cred);return g});
  return {cab:cab,M:M,cli:cli,total:j.total,cortado:j.cortado}}
function abrirCli(c){C.cli={doc:c.doc,nome:c.nome,linhas:c.linhas,credores:c.credores,cab:C.res.cab,M:C.res.M};C.sel={};
  c.linhas.forEach(function(r,i){C.sel[i]=1});C.form=null;C.view='ficha';render();var m=$('coMain');if(m)m.scrollIntoView({block:'start'})}

// ---- negociacao (referencia; o valor oficial sai do Cobmais) ----
function calc(){var F=C.cli;if(!F)return null;var M=F.M,mu=(numDe(C.sim.multa)||0)/100,ju=(numDe(C.sim.juros)||0)/100,orig=0,multa=0,juros=0,n=0,maior=0;
  F.linhas.forEach(function(r,i){if(!C.sel[i])return;var v=M.valor>=0?(numDe(r[M.valor])||0):0,a=M.venc>=0?atraso(r[M.venc]):null;n++;orig+=v;
    if(a!=null&&a>0){multa+=v*mu;juros+=v*ju*a/30;if(a>maior)maior=a}});
  var tot=orig+multa+juros,ent=Math.min(numDe(C.sim.entrada)||0,tot),np=Math.max(1,Math.min(48,parseInt(C.sim.parc,10)||1));
  return {n:n,orig:orig,multa:multa,juros:juros,tot:tot,ent:ent,np:np,parc:(tot-ent)/np,maior:maior}}
function proposta(){var K=calc(),F=C.cli;if(!K||!K.n)return '';var nome=tit(String(F.nome||'').split(/\s+/)[0]||'');
  var cred=F.credores.length===1?F.credores[0]:'';
  return 'Olá'+(nome?', '+nome:'')+'! Aqui é '+euNome()+', da Édimo'+(cred?', falando sobre '+cred:'')+'.\n'+
    'Para quitar à vista, o valor fica em '+money(K.orig)+', sem juros e sem multa.\n'+
    'Se preferir parcelar: '+(K.ent?'entrada de '+money(K.ent)+' + ':'')+K.np+'x de '+money(K.parc)+'.\n'+
    'Posso gerar o boleto pra você?'}

// ---- telas ----
function hd(t,p,ac){return '<div class="cx-hd"><div><h2>'+esc(t)+'</h2><p>'+esc(p)+'</p></div><div class="cx-tb" style="margin:0">'+(ac||'')+'</div></div>'}
function b(t,a,v,cls,extra){return '<button type="button" class="cx-btn '+(cls||'')+'" data-co="'+a+'"'+(v!=null?' data-v="'+esc(v)+'"':'')+(extra||'')+'>'+t+'</button>'}
function tagRes(k){var r=RES[k]||{t:k||'-',c:'#64748b'};return '<span class="cx-st" style="--c:'+r.c+'">'+esc(r.t)+'</span>'}
function aviso(){if(C.modo==='local')return '<div class="co-aviso"><b>Atendimentos salvos só neste computador.</b> A aba <code>'+ABA+'</code> ainda não respondeu na planilha'+(C.atErr?' ('+esc(C.atErr)+')':'')+'. Funciona para o piloto, mas outra máquina não vê.</div>';
  var P=pendentes();if(C.modo==='planilha'&&P.length)return '<div class="co-aviso">'+P.length+' atendimento'+(P.length>1?'s':'')+' ficou neste computador porque a planilha não respondeu. '+b('Enviar agora','pend',null,'sm pri')+'</div>';return ''}
function casca(conteudo){
  var L=C.at?lista():[],h=hojeIso(),ag=L.filter(function(x){return x.retorno&&x.feito!=='sim'&&x.retorno<=h}).length;
  var it=function(v,ic,t,n){return '<button type="button" class="cx-nav'+(C.view===v?' on':'')+'" data-co="ir" data-v="'+v+'">'+ic+' '+esc(t)+(n?'<em>'+n+'</em>':'')+'</button>'};
  var m='<aside class="cx-sb"><div class="cx-logo"><b>CRM Operador</b><small>Cobrança · piloto</small></div>'+
    it('dia','🏠','Meu dia')+it('busca','🔎','Buscar cliente')+(C.cli?it('ficha','📇',curtoNome(C.cli.nome)):'')+
    it('agenda','📅','Retornos e promessas',ag)+it('hist','🗂️','Atendimentos')+
    '<div class="cx-foot">'+(C.modo==='planilha'?'<b>●</b> Atendimentos na planilha':C.modo==='local'?'<b style="color:#d97706">●</b> Salvando neste computador':'Conectando...')+
    '<br>'+(C.info&&C.info.total?Number(C.info.total).toLocaleString('pt-BR')+' registros no banco':'')+'<br><a href="#" data-co="recarregar" style="color:#0f3557;font-weight:700">↻ Atualizar</a></div></aside>';
  var lado=$('coSide');if(!lado){lado=document.createElement('div');lado.id='coSide';document.body.appendChild(lado)}
  lado.innerHTML=m.replace('<aside class="cx-sb">','<aside class="cx-sb"><button type="button" class="cx-volta" data-co="voltar">&larr; Voltar ao portal</button>');
  return '<div class="cx co">'+m.replace('<aside class="cx-sb">','<aside class="cx-sb cx-sb-in">')+'<section class="cx-main" id="coMain">'+aviso()+conteudo+'</section></div>'}
function caixaBusca(grande){return '<div class="co-busca'+(grande?' gr':'')+'"><input class="cx-in" id="coQ" placeholder="Nome, CPF ou CNPJ do cliente" value="'+esc(C.q)+'" autocomplete="off">'+b(C.busc?'Buscando...':'🔎 Buscar','buscar',null,'pri',C.busc?' disabled':'')+'</div>'}

function vDia(){var L=lista(),h=hojeIso(),hj=L.filter(function(x){return String(x.data).slice(0,10)===h});
  var ab=L.filter(function(x){return x.retorno&&x.feito!=='sim'}),atr=ab.filter(function(x){return x.retorno<h}),deh=ab.filter(function(x){return x.retorno===h});
  var pr=hj.filter(function(x){return x.resultado==='promessa'}),ac=hj.filter(function(x){return x.resultado==='acordo'});
  var k=function(c,t,n,s,v){return '<button type="button" class="cx-k" style="--c:'+c+'" data-co="ir" data-v="'+v+'"><span>'+t+'</span><b>'+n+'</b><small>'+s+'</small></button>'};
  var o='Bom dia';var hr=new Date().getHours();if(hr>=12)o='Boa tarde';if(hr>=18)o='Boa noite';
  var x=hd(o+(euNome()?', '+euNome():''),'Sua fila de hoje: o que está atrasado primeiro, depois quem marcou para hoje.','');
  x+=caixaBusca(true);
  x+='<div class="cx-kp co-kp">'+k('#b91c1c','Atrasados',atr.length,'retornos e promessas vencidos','agenda')+k('#2563eb','Para hoje',deh.length,'combinados para hoje','agenda')+
    k('#b8901f','Atendimentos hoje',hj.length,'registrados por você','hist')+k('#16a34a','Promessas hoje',pr.length,money(pr.reduce(function(s,y){return s+(numDe(y.valor)||0)},0)),'hist')+
    k('#0f3557','Acordos hoje',ac.length,'informados no Cobmais','hist')+'</div>';
  var fila=atr.concat(deh).sort(function(a,b){return String(a.retorno).localeCompare(String(b.retorno))});
  x+='<div class="cx-card"><div class="co-ch"><b>Ligar agora</b><small>'+fila.length+' na fila</small></div>'+(fila.length?tabAg(fila.slice(0,30)):'<div class="cx-vazio"><b>Nada atrasado</b>Quando você registrar uma promessa ou um retorno, ele aparece aqui na data combinada.</div>')+'</div>';
  return x}
function tabAg(L){var h=hojeIso();return '<div class="cx-tw"><table class="cx-t"><thead><tr><th>Quando</th><th>Cliente</th><th>Credor</th><th>Combinado</th><th class="num">Valor</th><th></th></tr></thead><tbody>'+
  L.map(function(x){var d=diasAte(x.retorno),q=d==null?'':d<0?'<span class="cx-pz at">'+(-d)+'d atrasado</span>':d===0?'<span class="cx-pz hj">hoje</span>':'<span class="cx-pz">'+br(x.retorno)+'</span>';
    return '<tr><td>'+q+'</td><td class="nm">'+esc(tit(x.cliente)||'-')+'<small>'+esc(docFmt(x.cpf_cnpj))+(C.equipe?' · '+esc(x.operador):'')+'</small></td><td>'+esc(x.credor||'')+'</td><td>'+tagRes(x.resultado)+(x.obs?'<small class="co-obs">'+esc(String(x.obs).slice(0,90))+'</small>':'')+'</td><td class="num">'+(numDe(x.valor)?money(numDe(x.valor)):'')+'</td>'+
      '<td class="ac">'+b('Abrir ficha','ficha',x.cpf_cnpj||x.cliente,'sm pri')+b('Feito','feito',x.id,'sm')+'</td></tr>'}).join('')+'</tbody></table></div>'}

function vBusca(){var x=hd('Buscar cliente','Procura no banco de dados do portal: '+(C.info&&C.info.total?Number(C.info.total).toLocaleString('pt-BR')+' registros':'carregando')+' das planilhas importadas.','');
  x+=caixaBusca(false);
  if(C.infoErr)return x+'<div class="cx-card"><div class="cx-vazio"><b>Não consegui abrir o banco de dados</b>'+esc(C.infoErr)+'<br><br>'+b('Tentar de novo','info')+'</div></div>';
  if(C.busc)return x+'<div class="cx-card"><div class="cx-vazio">Buscando no banco...</div></div>';
  if(C.resErr)return x+'<div class="cx-card"><div class="cx-vazio"><b>A busca não deu certo</b>'+esc(C.resErr)+'</div></div>';
  if(!C.res)return x+'<div class="cx-card"><div class="cx-vazio"><b>Digite o CPF ou o nome</b>CPF/CNPJ abre a ficha direto. Nome mostra a lista para você escolher.</div></div>';
  var R=C.res;if(!R.cli.length)return x+'<div class="cx-card"><div class="cx-vazio"><b>Ninguém encontrado</b>Confira o número ou tente parte do nome. Se o cliente é de uma carteira nova, a planilha dele precisa ser importada no banco.</div></div>';
  x+='<div class="cx-card"><div class="co-ch"><b>'+R.cli.length+' cliente'+(R.cli.length>1?'s':'')+'</b><small>'+(R.cortado?'muitos resultados, mostrando os primeiros: refine a busca':'')+'</small></div><div class="cx-tw"><table class="cx-t"><thead><tr><th>Cliente</th><th>Credor</th><th class="num">Registros</th><th class="num">Valor original</th><th></th></tr></thead><tbody>'+
    R.cli.slice(0,100).map(function(c,i){return '<tr><td class="nm">'+esc(tit(c.nome)||'(sem nome)')+'<small>'+esc(docFmt(c.doc))+'</small></td><td>'+esc(c.credores.slice(0,2).join(', ')+(c.credores.length>2?' +'+(c.credores.length-2):''))+'</td><td class="num">'+c.linhas.length+'</td><td class="num">'+(c.total?money(c.total):'')+'</td><td class="ac">'+b('Abrir ficha','abrir',i,'sm pri')+'</td></tr>'}).join('')+'</tbody></table></div></div>';
  return x}

function vFicha(){var F=C.cli;if(!F){C.view='busca';return vBusca()}
  var M=F.M,R=F.linhas,u=function(i,r){return i>=0?String(r[i]==null?'':r[i]).trim():''};
  var tels={},mails={},ends={};R.forEach(function(r){M.tel.forEach(function(i){var t=soDig(r[i]);if(t.length>=10)tels[t.replace(/^55(?=\d{10,11}$)/,'')]=1});M.email.forEach(function(i){var e=u(i,r);if(/@/.test(e))mails[e.toLowerCase()]=1});
    var e=M.end.map(function(i){return u(i,r)}).filter(String).join(', ');if(e)ends[e]=1});
  var imp=R.map(function(r){return u(M.imp,r)}).filter(String).sort().pop()||'';
  var x='<div class="cx-hd"><div><h2>'+esc(tit(F.nome)||'(sem nome)')+'</h2><p>'+esc(docFmt(F.doc))+' · '+esc(F.credores.join(', ')||'sem credor')+'</p></div><div class="cx-tb" style="margin:0">'+b('📝 Registrar atendimento','novo',null,'pri')+b('← Busca','ir','busca')+'</div></div>';
  x+='<div class="co-aviso az">Situação da última planilha importada'+(imp?' ('+esc(br(imp))+')':'')+'. <b>Antes de cobrar, confira no Cobmais se já pagou ou fez acordo.</b></div>';
  if(C.form)x+=vForm();
  x+='<div class="co-g2"><div class="cx-box"><h3>Contato</h3>'+
    (Object.keys(tels).length?'<div class="co-tels">'+Object.keys(tels).map(function(t){return '<span><b>'+esc(telFmt(t))+'</b><button type="button" class="co-cp" data-co="copiar" data-v="'+esc(t)+'" title="Copiar">⧉</button></span>'}).join('')+'</div>':'<div class="co-mut">Sem telefone na planilha.</div>')+
    (Object.keys(mails).length?'<div class="co-lin">✉ '+Object.keys(mails).map(esc).join(' · ')+'</div>':'')+
    (Object.keys(ends).length?'<div class="co-lin">📍 '+esc(Object.keys(ends)[0])+'</div>':'')+'</div>';
  // negociacao
  var K=calc();
  x+='<div class="cx-box"><h3>Negociação <small>referência, o valor oficial sai do Cobmais</small></h3>'+
    '<div class="co-neg"><div class="co-op vista"><span>À vista</span><b>'+money(K.orig)+'</b><small>só o valor original, sem juros e multa</small></div>'+
    '<div class="co-op"><span>Parcelado</span><b>'+(K.ent?money(K.ent)+' + ':'')+K.np+'x '+money(K.parc)+'</b><small>total '+money(K.tot)+' com multa '+money(K.multa)+' e juros '+money(K.juros)+'</small></div></div>'+
    '<div class="co-sim"><label>Multa %<input class="cx-in" data-sim="multa" value="'+esc(C.sim.multa)+'" inputmode="decimal"></label><label>Juros % ao mês<input class="cx-in" data-sim="juros" value="'+esc(C.sim.juros)+'" inputmode="decimal"></label>'+
    '<label>Entrada R$<input class="cx-in" data-sim="entrada" value="'+esc(C.sim.entrada)+'" inputmode="decimal" placeholder="0"></label><label>Parcelas<input class="cx-in" data-sim="parc" value="'+esc(C.sim.parc)+'" inputmode="numeric"></label></div>'+
    '<div class="co-mut">'+K.n+' de '+R.length+' registros marcados'+(K.maior?' · maior atraso '+K.maior+' dias':'')+'. Multa e juros variam por credor: ajuste conforme a regra dele.</div>'+
    '<div class="cx-tb" style="margin:10px 0 0">'+b('⧉ Copiar proposta','proposta',null,'sm')+b('Registrar com esta proposta','novo','prop','sm pri')+'</div></div></div>';
  // parcelas
  x+='<div class="cx-card"><div class="co-ch"><b>Parcelas e contratos</b><small>'+R.length+' registro'+(R.length>1?'s':'')+' no banco</small></div><div class="cx-tw"><table class="cx-t"><thead><tr><th><input type="checkbox" data-co="todas"'+(K.n===R.length?' checked':'')+'></th><th>Credor</th><th>Contrato</th><th>Parcela</th><th>Vencimento</th><th class="num">Atraso</th><th class="num">Valor original</th>'+(M.atual>=0?'<th class="num">Atualizado (planilha)</th>':'')+(M.sit>=0?'<th>Situação</th>':'')+'</tr></thead><tbody>'+
    R.map(function(r,i){var a=M.venc>=0?atraso(r[M.venc]):null;return '<tr><td><input type="checkbox" data-co="sel" data-v="'+i+'"'+(C.sel[i]?' checked':'')+'></td><td>'+esc(u(M.credor,r))+'</td><td>'+esc(u(M.contrato,r))+'</td><td>'+esc(u(M.parcela,r))+'</td><td>'+esc(u(M.venc,r))+'</td><td class="num"'+(a>90?' style="color:#b91c1c;font-weight:800"':'')+'>'+(a==null?'':a>0?a+'d':'em dia')+'</td><td class="num">'+(M.valor>=0&&numDe(r[M.valor])!=null?money(numDe(r[M.valor])):'')+'</td>'+(M.atual>=0?'<td class="num">'+(numDe(r[M.atual])!=null?money(numDe(r[M.atual])):'')+'</td>':'')+(M.sit>=0?'<td>'+esc(u(M.sit,r))+'</td>':'')+'</tr>'}).join('')+'</tbody></table></div></div>';
  // historico do cliente
  var H=(C.at||[]).concat(locais().filter(function(y){return C.modo!=='planilha'||y.pend})).filter(function(y){return F.doc?docNorm(y.cpf_cnpj)===F.doc:nz(y.cliente)===nz(F.nome)}).sort(function(a,b){return String(b.data).localeCompare(String(a.data))});
  x+='<div class="cx-card" style="margin-top:14px"><div class="co-ch"><b>Histórico na Édimo</b><small>atendimentos registrados aqui, de todas as operadoras</small></div>'+(H.length?'<div class="co-hist">'+H.map(function(y){return '<div><span class="co-qd">'+esc(br(String(y.data).slice(0,10)))+' '+esc(hora(y.data))+'<br><small>'+esc(y.operador)+' · '+esc(y.canal||'')+'</small></span><div>'+tagRes(y.resultado)+(y.retorno?' <span class="cx-pz">'+(y.resultado==='promessa'?'pagar ':'retornar ')+esc(br(y.retorno))+'</span>':'')+(numDe(y.valor)?' <b>'+money(numDe(y.valor))+'</b>':'')+(y.obs?'<p>'+esc(y.obs)+'</p>':'')+'</div></div>'}).join('')+'</div>':'<div class="cx-vazio" style="padding:22px">Nenhum atendimento registrado aqui ainda. O histórico antigo continua no Cobmais.</div>')+'</div>';
  return x}
function vForm(){var f=C.form,F=C.cli,r=RES[f.resultado]||{};
  var cr=F.credores.length>1?'<label>Credor<select class="cx-sel" data-f="credor">'+F.credores.map(function(c){return '<option'+(f.credor===c?' selected':'')+'>'+esc(c)+'</option>'}).join('')+'</select></label>':'';
  return '<div class="cx-box co-form"><h3>Registrar atendimento <small>'+esc(tit(F.nome))+'</small></h3>'+
    '<div class="co-res">'+RESULT.map(function(x){return '<button type="button" class="cx-chip'+(f.resultado===x[0]?' on':'')+'" style="--c:'+x[2]+'" data-co="res" data-v="'+x[0]+'">'+esc(x[1])+'</button>'}).join('')+'</div>'+
    '<div class="co-fg"><label>Canal<select class="cx-sel" data-f="canal">'+CANAIS.map(function(c){return '<option'+(f.canal===c?' selected':'')+'>'+c+'</option>'}).join('')+'</select></label>'+cr+
    (r.ret?'<label>'+(f.resultado==='promessa'?'Vai pagar em':'Retornar em')+'<input type="date" class="cx-in" data-f="retorno" value="'+esc(f.retorno)+'"></label>':'')+
    (f.resultado==='promessa'||f.resultado==='acordo'?'<label>Valor R$<input class="cx-in" data-f="valor" value="'+esc(f.valor)+'" inputmode="decimal"></label>':'')+
    '<label class="full">Observação<textarea class="cx-in" rows="3" data-f="obs" maxlength="1000" placeholder="O que foi combinado, objeção, melhor horário...">'+esc(f.obs)+'</textarea></label></div>'+
    (C.msg?'<div class="cx-err">'+esc(C.msg)+'</div>':'')+
    '<div class="cx-tb" style="margin:6px 0 0;justify-content:flex-end">'+b('Cancelar','cancelar')+b(C.salvando?'Salvando...':'Salvar atendimento','salvar',null,'pri',C.salvando?' disabled':'')+'</div>'+
    (f.resultado==='acordo'?'<div class="co-mut">O acordo e o boleto continuam sendo feitos no Cobmais. Aqui fica o registro para a fila e o histórico.</div>':'')+'</div>'}

function vAgenda(){var L=lista().filter(function(x){return x.retorno&&x.feito!=='sim'}),h=hojeIso(),s7=addDias(7);
  var G={atras:L.filter(function(x){return x.retorno<h}),hoje:L.filter(function(x){return x.retorno===h}),prox:L.filter(function(x){return x.retorno>h&&x.retorno<=s7}),todos:L};
  var f=G[C.fAg]?C.fAg:'atras',Lf=G[f].sort(function(a,b){return String(a.retorno).localeCompare(String(b.retorno))});
  var ch=function(k,t,c){return '<button type="button" class="cx-chip'+(f===k?' on':'')+'" style="--c:'+c+'" data-co="fag" data-v="'+k+'">'+t+'<i>'+G[k].length+'</i></button>'};
  var x=hd('Retornos e promessas','Tudo que alguém combinou de pagar ou pediu retorno. Marque Feito quando resolver.',equipeBtn());
  x+='<div class="cx-chips">'+ch('atras','Atrasados','#b91c1c')+ch('hoje','Hoje','#d97706')+ch('prox','Próximos 7 dias','#2563eb')+ch('todos','Todos em aberto','#475569')+'</div>';
  return x+'<div class="cx-card">'+(Lf.length?tabAg(Lf):'<div class="cx-vazio"><b>Nada aqui</b>Nenhum retorno nesse filtro.</div>')+'</div>'}
function equipeBtn(){return lider()?b(C.equipe?'👥 Equipe toda':'👤 Só os meus','equipe',null,'sm'):''}
function vHist(){var L=lista(),q=nz(C.fHist);if(q)L=L.filter(function(x){return nz([x.cliente,x.cpf_cnpj,x.credor,x.obs,(RES[x.resultado]||{}).t,x.operador].join(' ')).indexOf(q)>=0});
  var x=hd('Atendimentos',L.length+' registro'+(L.length===1?'':'s')+(C.equipe?' da equipe':' seus'),equipeBtn()+b('⬇ CSV','csv',null,'sm'));
  x+='<div class="cx-tb"><input class="cx-in" id="coH" placeholder="Filtrar por cliente, credor, resultado..." value="'+esc(C.fHist)+'"></div>';
  if(!L.length)return x+'<div class="cx-card"><div class="cx-vazio"><b>Nenhum atendimento ainda</b>Busque um cliente e clique em Registrar atendimento.</div></div>';
  return x+'<div class="cx-card"><div class="cx-tw"><table class="cx-t"><thead><tr><th>Quando</th><th>Cliente</th><th>Credor</th><th>Canal</th><th>Resultado</th><th>Retorno</th><th class="num">Valor</th><th></th></tr></thead><tbody>'+
    L.slice(0,300).map(function(y){return '<tr><td>'+esc(br(String(y.data).slice(0,10)))+' <small style="color:#9ca3af">'+esc(hora(y.data))+'</small>'+(y.pend?' <span class="cx-pz at">neste PC</span>':'')+'</td><td class="nm">'+esc(tit(y.cliente)||'-')+'<small>'+esc(docFmt(y.cpf_cnpj))+(C.equipe?' · '+esc(y.operador):'')+'</small></td><td>'+esc(y.credor||'')+'</td><td>'+esc(y.canal||'')+'</td><td>'+tagRes(y.resultado)+'</td><td>'+esc(br(y.retorno))+(y.feito==='sim'?' ✓':'')+'</td><td class="num">'+(numDe(y.valor)?money(numDe(y.valor)):'')+'</td><td class="ac">'+b('Ficha','ficha',y.cpf_cnpj||y.cliente,'sm')+'</td></tr>'}).join('')+'</tbody></table></div></div>'}

function pedeSenha(msg){if(!EL)return;C.senha=true;
  EL.innerHTML='<div class="cx co"><aside class="cx-sb cx-sb-in"><div class="cx-logo"><b>CRM Operador</b><small>Cobrança · piloto</small></div></aside><section class="cx-main"><div class="cx-card"><div class="cx-vazio"><div class="cx-pw"><b>Confirme sua senha</b>Pra liberar o CRM neste computador, digite a senha do portal uma vez.<input type="password" class="cx-in" id="coSenha" placeholder="Sua senha"><button type="button" class="cx-btn pri" data-co="entrar">Entrar</button>'+(msg?'<div class="cx-err">'+esc(msg)+'</div>':'')+'</div></div></div></section></div>';
  var lado=$('coSide');if(lado)lado.innerHTML='<aside class="cx-sb"><button type="button" class="cx-volta" data-co="voltar">&larr; Voltar ao portal</button><div class="cx-logo"><b>CRM Operador</b><small>Cobrança · piloto</small></div></aside>';
  setTimeout(function(){var i=$('coSenha');if(i)i.focus()},50)}
function entrar(){var i=$('coSenha');if(!i||!i.value)return;var bt=i.nextElementSibling;if(bt)bt.disabled=true;
  post({type:'qtoken',login:eu(),senha:i.value}).then(function(j){if(j.status==='ok'&&j.token){tokSet(j.token);C.senha=false;iniciar()}else pedeSenha(j.msg==='senha'?'Senha incorreta.':(j.msg||'Não deu certo.'))}).catch(function(){pedeSenha('Sem conexão. Tente de novo.')})}

function render(){if(!EL||!ativo())return;if(C.senha)return;
  var foco=document.activeElement&&document.activeElement.id,pos=0;try{pos=document.activeElement.selectionStart}catch(e){}
  var h=C.view==='busca'?vBusca():C.view==='ficha'?vFicha():C.view==='agenda'?vAgenda():C.view==='hist'?vHist():vDia();
  EL.innerHTML=casca(h);
  if(foco&&/^co[QH]$/.test(foco)){var q=$(foco);if(q){q.focus();try{q.setSelectionRange(pos,pos)}catch(e){}}}}
function iniciar(){if(!tokGet()){pedeSenha('');return}C.senha=false;carregaInfo();carregaAt();render()}
function ativo(){var p=$('pageCob');return !!(p&&p.classList.contains('active'))}

// ---- acoes ----
function novoForm(prop){var F=C.cli,K=calc();C.msg='';
  C.form={resultado:prop?'promessa':'',canal:'Ligação',credor:F.credores[0]||'',retorno:prop?addDias(1):'',valor:prop&&K&&K.n?(K.ent||K.orig).toFixed(2).replace('.',','):'',
    obs:prop&&K&&K.n?('Proposta: à vista '+money(K.orig)+' ou '+(K.ent?money(K.ent)+' + ':'')+K.np+'x '+money(K.parc)):''}}
function lerForm(){var f=C.form;if(!f)return;document.querySelectorAll('#pageCob [data-f]').forEach(function(e){f[e.getAttribute('data-f')]=e.value})}
function salvar(){lerForm();var f=C.form,F=C.cli;if(!f||!F)return;
  if(!f.resultado){C.msg='Escolha o resultado do atendimento.';render();return}
  if(RES[f.resultado].ret&&(f.resultado==='promessa'||f.resultado==='retornar')&&!f.retorno){C.msg='Coloque a data combinada.';render();return}
  if(f.retorno&&f.retorno<hojeIso()){C.msg='A data combinada já passou.';render();return}
  var M=F.M,contr={};F.linhas.forEach(function(r,i){if(C.sel[i]&&M.contrato>=0&&r[M.contrato])contr[r[M.contrato]]=1});
  var o={data:agoraLocal(),operador:eu(),cpf_cnpj:F.doc,cliente:F.nome,credor:f.credor||F.credores[0]||'',contrato:Object.keys(contr).slice(0,5).join(', '),
    canal:f.canal,resultado:f.resultado,retorno:RES[f.resultado].ret?(f.retorno||''):'',valor:f.valor||'',obs:String(f.obs||'').slice(0,1000),feito:''};
  C.salvando=true;render();
  salvarAt(o).then(function(r){C.salvando=false;C.form=null;C.msg='';render();toast(r==='planilha'?'Atendimento salvo na planilha':r==='pendente'?'Planilha não respondeu: ficou neste computador':'Atendimento salvo neste computador')})
  .catch(function(e){C.salvando=false;if(e.relogin){pedeSenha('');return}C.msg='Não salvou: '+e.message;render()})}
function feito(id){var x=lista().find(function(y){return y.id===id});if(!x)return;var o=Object.assign({},x);o.feito='sim';
  salvarAt(o).then(function(){render();toast('Marcado como feito')}).catch(function(e){if(e.relogin)pedeSenha('');else toast('Não salvou: '+e.message)})}
function abrirPorRef(v){var d=docNorm(v);if(C.cli&&d&&C.cli.doc===d){C.view='ficha';render();return}C.q=d.length>=11?docFmt(d):String(v||'');buscar(C.q,d.length>=11?d:'')}
function copiar(t){if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(function(){toast('Copiado')},function(){toast('Não consegui copiar')});else toast('Não consegui copiar')}
function csv(){var L=lista(),K=CAMPOS,q=function(v){v=String(v==null?'':v);if(/^[=+\-@]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};
  var rows=L.map(function(y){return K.map(function(k){return q(k==='resultado'?(RES[y[k]]||{t:y[k]}).t:k==='data'?br(String(y.data).slice(0,10))+' '+hora(y.data):y[k])}).join(';')});
  var blob=new Blob(['\uFEFF'+[K.map(q).join(';')].concat(rows).join('\r\n')],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='atendimentos-'+hojeIso()+'.csv';document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}
var ANT='ranking';
function acao(a,v,el){
  if(a==='ir'){C.view=v;render();return}
  if(a==='voltar'){window.showPage(ANT&&ANT!=='cob'?ANT:'ranking');return}
  if(a==='recarregar'){C.info=null;C.at=null;iniciar();return}
  if(a==='info'){C.infoErr='';carregaInfo();render();return}
  if(a==='buscar'){var i=$('coQ');buscar(i?i.value:C.q);return}
  if(a==='abrir'){var c=C.res&&C.res.cli[+v];if(c)abrirCli(c);return}
  if(a==='ficha'){abrirPorRef(v);return}
  if(a==='novo'){novoForm(v==='prop');render();var m=$('coMain');if(m)m.scrollIntoView({block:'start'});return}
  if(a==='res'){lerForm();C.form.resultado=v;if(RES[v].ret&&!C.form.retorno)C.form.retorno=addDias(v==='promessa'?1:0);C.msg='';render();return}
  if(a==='cancelar'){C.form=null;C.msg='';render();return}
  if(a==='salvar'){salvar();return}
  if(a==='feito'){feito(v);return}
  if(a==='sel'){C.sel[+v]=el.checked?1:0;render();return}
  if(a==='todas'){var on=el.checked;C.cli.linhas.forEach(function(r,i){C.sel[i]=on?1:0});render();return}
  if(a==='proposta'){var t=proposta();if(!t){toast('Marque pelo menos uma parcela');return}copiar(t);return}
  if(a==='copiar'){copiar(v);return}
  if(a==='fag'){C.fAg=v;render();return}
  if(a==='equipe'){C.equipe=!C.equipe;render();return}
  if(a==='csv'){csv();return}
  if(a==='pend'){enviarPend();return}
  if(a==='entrar'){entrar();return}
}
function onClick(e){var t=e.target.closest&&e.target.closest('[data-co]');if(!t)return;var a=t.getAttribute('data-co');
  if(t.tagName==='A')e.preventDefault();if(t.type==='checkbox'){acao(a,t.getAttribute('data-v'),t);return}
  acao(a,t.getAttribute('data-v'),t)}
function onInput(e){var t=e.target;if(!t)return;
  if(t.hasAttribute&&t.hasAttribute('data-sim')){C.sim[t.getAttribute('data-sim')]=t.value;clearTimeout(onInput._t);onInput._t=setTimeout(render,350);return}
  if(t.id==='coQ'){C.q=t.value;return}
  if(t.id==='coH'){C.fHist=t.value;render();return}
  if(t.hasAttribute&&t.hasAttribute('data-f')&&C.form){C.form[t.getAttribute('data-f')]=t.value}}
function onKey(e){var t=e.target;if(e.key!=='Enter'||!t)return;if(t.id==='coQ'){e.preventDefault();buscar(t.value)}else if(t.id==='coSenha'){e.preventDefault();entrar()}}

// ---- liga no portal ----
function pode(){if(typeof cU==='undefined'||!cU)return false;if(typeof window.pode==='function')return window.pode('cob');return String(cU.perfil||'')==='admin'}
function montar(){
  if(!$('sbCO')){var ref=$('sbW')||$('sbR');if(!ref||!ref.parentNode)return false;var bt=document.createElement('button');bt.className='sb-item';bt.id='sbCO';bt.style.display='none';
    bt.setAttribute('onclick',"showPage('cob')");bt.innerHTML='\uD83D\uDCBC CRM Operador';ref.parentNode.insertBefore(bt,ref.nextSibling)}
  if(!$('pageCob')){var m=document.querySelector('.main');if(!m)return false;var p=document.createElement('div');p.className='page';p.id='pageCob';m.appendChild(p);
    p.addEventListener('click',onClick);p.addEventListener('input',onInput);p.addEventListener('change',onInput);p.addEventListener('keydown',onKey)}
  if(!$('coSide')){var s=document.createElement('div');s.id='coSide';document.body.appendChild(s);s.addEventListener('click',onClick)}
  EL=$('pageCob');return true}
function ligar(){
  montar();
  var sp=window.showPage;if(typeof sp!=='function'||sp._co)return;
  var novo=function(p){if(p!=='cob')ANT=p;sp.apply(this,arguments);montar();
    var on=p==='cob'&&pode(),pg=$('pageCob'),sb=$('sbCO');
    if(p==='cob'&&!pode()){if(pg)pg.classList.remove('active');document.body.classList.remove('cob-on');return}
    document.body.classList.toggle('cob-on',on);if(pg)pg.classList.toggle('active',on);if(sb)sb.classList.toggle('active',on);
    if(on)iniciar()};
  novo._co=1;window.showPage=novo;
  setInterval(function(){montar();var sb=$('sbCO');if(sb)sb.style.display=pode()?'':'none';
    if(C.at!=null&&C._eu!==eu()){C.at=null;C.cli=null;C.res=null;C.form=null;C.view='dia'}C._eu=eu()},700)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ligar);else ligar();
window.CRMOP={_calc:calc,_mapa:mapa,_agrupa:agrupa,_C:C};
})();

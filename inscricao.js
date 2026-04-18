/* inscricao.js — lógica do formulário de inscrição */
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let obraCount = 0;
let fotoFile  = null; // arquivo de foto selecionado

function goStep(n) {
  if (n === 1) {
    const ok = document.getElementById('consentimento').checked;
    const err = document.getElementById('err0');
    if (!ok) { err.classList.add('show'); return; }
    err.classList.remove('show');
  }
  if (n === 2) { if (!validateStep1()) return; }
  if (n === 3) { if (!validateStep2()) return; }
  // n===4: sem validacao — etapa obras é opcional
  if (n === 5) { buildReview(); }

  document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
  document.getElementById('section' + n).classList.add('active');

  for (let i = 0; i <= 5; i++) {
    const el = document.getElementById('step' + i);
    if (!el) continue;
    el.classList.remove('active', 'done');
    if (i === n) el.classList.add('active');
    else if (i < n) el.classList.add('done');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── VALIDAÇÃO ETAPA 1 ────────────────────────────────────────────────
function validateStep1() {
  const missing = [];
  const nome  = document.getElementById('nome').value.trim();
  const bio   = document.getElementById('bio').value.trim();
  const email = document.getElementById('email').value.trim();

  if (!nome) {
    setErr('err-nome', 'Você esqueceu de preencher o <strong>Nome completo</strong>.');
    mark('nome'); missing.push('Nome completo');
  } else { clearErr('err-nome'); unmark('nome'); }

  if (!bio) {
    setErr('err-bio', 'Você esqueceu de preencher a <strong>Mini bio</strong>.');
    mark('bio'); missing.push('Mini bio');
  } else { clearErr('err-bio'); unmark('bio'); }

  if (!email) {
    setErr('err-email', 'Você esqueceu de preencher o <strong>E-mail</strong>.');
    mark('email'); missing.push('E-mail');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setErr('err-email', 'O <strong>E-mail</strong> informado não é válido.');
    mark('email'); missing.push('E-mail válido');
  } else { clearErr('err-email'); unmark('email'); }

  const banner = document.getElementById('banner-step1');
  if (missing.length) {
    banner.innerHTML = missing.length === 1
      ? 'Você esqueceu de preencher: <strong>' + missing[0] + '</strong>.'
      : 'Você esqueceu de preencher: <strong>' + missing.slice(0, -1).join(', ') + '</strong> e <strong>' + missing[missing.length - 1] + '</strong>.';
    banner.classList.add('show');
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  banner.classList.remove('show');
  return true;
}

// ── VALIDAÇÃO ETAPA 2 ────────────────────────────────────────────────
function validateStep2() {
  const missing = [];
  const areaVal = document.getElementById('area').value;
  const instVal = document.getElementById('instituicao').value;

  if (!areaVal) {
    setErr('err-area', 'Você esqueceu de selecionar a <strong>Área principal</strong>.');
    mark('area'); missing.push('Área principal');
  } else { clearErr('err-area'); unmark('area'); }

  if (!instVal) {
    setErr('err-inst', 'Você esqueceu de selecionar a <strong>Instituição</strong>.');
    mark('instituicao'); missing.push('Instituição');
  } else { clearErr('err-inst'); unmark('instituicao'); }

  const banner = document.getElementById('banner-step2');
  if (missing.length) {
    banner.innerHTML = missing.length === 1
      ? 'Você esqueceu de preencher: <strong>' + missing[0] + '</strong>.'
      : 'Você esqueceu de preencher: <strong>' + missing.slice(0, -1).join(', ') + '</strong> e <strong>' + missing[missing.length - 1] + '</strong>.';
    banner.classList.add('show');
    banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  banner.classList.remove('show');
  return true;
}

// ── FOTO DE PERFIL ────────────────────────────────────────────────────
function previewFotoInscricao(input) {
  const file = input.files[0];
  if (!file) return;
  fotoFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('fotoPreview');
    preview.innerHTML = '<img src="' + e.target.result + '" alt="Prévia da foto">';
    document.getElementById('fotoHint').textContent = '✓ ' + file.name + ' — será salva ao concluir';
  };
  reader.readAsDataURL(file);
}

async function uploadFotoInscricao(researcherId) {
  if (!fotoFile || !researcherId) return null;
  try {
    const ext  = fotoFile.name.split('.').pop().toLowerCase();
    const path = researcherId + '.' + ext;
    const { error } = await db.storage.from('researchers-avatars').upload(path, fotoFile, { upsert: true });
    if (error) { console.warn('Erro no upload da foto:', error.message); return null; }
    const { data } = db.storage.from('researchers-avatars').getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.warn('Erro inesperado no upload da foto:', e);
    return null;
  }
}

// ── PUBLICAÇÕES ───────────────────────────────────────────────────────
function addObra() {
  const wrap = document.getElementById('obrasWrap');
  const id = ++obraCount;
  const div = document.createElement('div');
  div.className = 'obra-item';
  div.id = 'obra-' + id;
  div.innerHTML =
    '<button class="obra-remove" onclick="document.getElementById(\'obra-' + id + '\').remove()" title="Remover">✕</button>' +
    '<div class="obra-grid">' +
      '<div class="full"><label>Título <span class="req">*</span></label><input type="text" class="obra-titulo" placeholder="Título da publicação"></div>' +
      '<div><label>Tipo</label><select class="obra-tipo">' +
        '<option>Livro</option><option>Tese de Doutorado</option><option>Dissertação de Mestrado</option>' +
        '<option>TCC</option><option>Artigo Científico</option><option>Capítulo de Livro</option>' +
        '<option>Monografia</option><option>Relatório Técnico</option>' +
      '</select></div>' +
      '<div><label>Ano</label><input type="number" class="obra-ano" placeholder="2024" min="1900" max="2099"></div>' +
      '<div class="full"><label>Tags (separadas por vírgula)</label><input type="text" class="obra-tags" placeholder="gênero, educação, ciência…"></div>' +
      '<div><label>Link de acesso (PDF/DOI)</label><input type="url" class="obra-acesso" placeholder="https://…"></div>' +
      '<div><label>Link de compra</label><input type="url" class="obra-compra" placeholder="https://…"></div>' +
    '</div>';
  wrap.appendChild(div);
}

// ── REVISÃO ───────────────────────────────────────────────────────────
function buildReview() {
  const v = id => { const el = document.getElementById(id); return el ? el.value.trim() : '—'; };
  const obras = [];
  document.querySelectorAll('.obra-item').forEach(item => {
    const titulo = item.querySelector('.obra-titulo')?.value.trim();
    if (!titulo) return;
    obras.push({ titulo, tipo: item.querySelector('.obra-tipo')?.value||'', ano: item.querySelector('.obra-ano')?.value||'' });
  });

  // Prévia da foto na revisão
  const fotoPreviewEl = document.getElementById('fotoPreview');
  const temFoto = fotoFile !== null;
  const fotoHtml = temFoto
    ? '<div class="review-row"><span class="review-label">Foto</span><span class="review-val" style="display:flex;align-items:center;gap:.5rem">' + fotoPreviewEl.innerHTML + '<span style="font-size:.8rem;color:var(--cinza)">será enviada</span></span></div>'
    : '';

  const rows = (label, val) => (val && val !== '—') ? '<div class="review-row"><span class="review-label">'+label+'</span><span class="review-val">'+val+'</span></div>' : '';
  let html = '<div class="review-section"><h3>Dados pessoais</h3>' +
    fotoHtml +
    rows('Nome', v('nome')) + rows('E-mail', v('email')) +
    (v('cidade') !== '—' ? rows('Cidade', v('cidade')) : '') + rows('Mini bio', v('bio')) + '</div>' +
    '<div class="review-section"><h3>Área & Instituição</h3>' +
    rows('Área', document.getElementById('area')?.value) +
    rows('Instituição', document.getElementById('instituicao')?.value) + '</div>' +
    '<div class="review-section"><h3>Links acadêmicos</h3>' +
    (v('lattes')  !== '—' ? rows('Lattes',   v('lattes'))  : '') +
    (v('orcid')   !== '—' ? rows('ORCID',    v('orcid'))   : '') +
    (v('linkedin')!== '—' ? rows('LinkedIn', v('linkedin')): '') +
    (v('scholar') !== '—' ? rows('Scholar',  v('scholar')) : '') + '</div>';
  if (obras.length) {
    html += '<div class="review-section"><h3>Publicações (' + obras.length + ')</h3>';
    obras.forEach(o => { html += '<div class="review-obra"><div class="review-obra-title">'+o.titulo+'</div><div class="review-obra-meta">'+o.tipo+(o.ano?' · '+o.ano:'')+'</div></div>'; });
    html += '</div>';
  }
  document.getElementById('reviewContent').innerHTML = html;
}

// ── ENVIO ─────────────────────────────────────────────────────────────
async function submitForm() {
  const aceita = document.getElementById('aceitaPrivacidade').checked;
  const errPriv = document.getElementById('errPrivacidade');
  if (!aceita) {
    errPriv.innerHTML = 'Você precisa aceitar a <strong>Política de Privacidade</strong> para concluir.';
    errPriv.classList.add('show'); return;
  }
  errPriv.classList.remove('show');

  const btn = document.getElementById('btnSubmit');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Enviando…';

  try {
    const g = id => { const el = document.getElementById(id); return el ? (el.value.trim() || null) : null; };
    const payload = {
      nome: g('nome'), mini_bio: g('bio'), email: g('email'), estado: g('cidade'),
      area_principal: document.getElementById('area')?.value || null,
      instituicao:    document.getElementById('instituicao')?.value || null,
      lattes: g('lattes'), orcid: g('orcid'), linkedin: g('linkedin'),
      google_scholar: g('scholar'), research_gate: g('researchgate'), site: g('site'),
      status: 'pendente', destaque: false, consentimento_lgpd: true,
    };

    // 1. Insere a pesquisadora
    const res = await db.from('researchers').insert([payload]).select().single();
    if (res.error) throw new Error(res.error.message);
    const researcherId = res.data.id;

    // 2. Faz upload da foto (se houver) e atualiza o registro
    if (fotoFile) {
      btn.innerHTML = '<span class="spinner"></span> Enviando foto…';
      const fotoUrl = await uploadFotoInscricao(researcherId);
      if (fotoUrl) {
        await db.from('researchers').update({ foto_url: fotoUrl }).eq('id', researcherId);
      }
    }

    // 3. Insere obras
    const obras = [];
    document.querySelectorAll('.obra-item').forEach(item => {
      const titulo = item.querySelector('.obra-titulo')?.value.trim();
      const tipo   = item.querySelector('.obra-tipo')?.value;
      if (!titulo || !tipo) return;
      obras.push({
        researcher_id: researcherId, titulo, tipo,
        ano:  parseInt(item.querySelector('.obra-ano')?.value) || null,
        tags: (item.querySelector('.obra-tags')?.value||'').split(',').map(t=>t.trim()).filter(Boolean),
        link_acesso: item.querySelector('.obra-acesso')?.value.trim() || null,
        link_compra: item.querySelector('.obra-compra')?.value.trim() || null,
        area_conhecimento: document.getElementById('area')?.value || null,
        status: 'pendente',
      });
    });

    if (obras.length) {
      const wRes = await db.from('works').insert(obras);
      if (wRes.error) throw new Error('Perfil salvo, mas erro nas obras: ' + wRes.error.message);
    }

    document.getElementById('successNome').textContent = payload.nome;
    document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
    document.getElementById('sectionSuccess').classList.add('active');
    document.querySelector('.progress-bar').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch(e) {
    btn.disabled = false;
    btn.innerHTML = '🎉 Concluir inscrição';
    alert('Erro ao enviar: ' + e.message);
  }
}

// ── HELPERS ───────────────────────────────────────────────────────────
function show(id)         { const el = document.getElementById(id); if (el) el.classList.add('show'); }
function hide(id)         { const el = document.getElementById(id); if (el) el.classList.remove('show'); }
function mark(id)         { const el = document.getElementById(id); if (el) el.classList.add('erro'); }
function unmark(id)       { const el = document.getElementById(id); if (el) el.classList.remove('erro'); }
function setErr(id, html) { const el = document.getElementById(id); if (el) { el.innerHTML = html; el.classList.add('show'); } }
function clearErr(id)     { const el = document.getElementById(id); if (el) { el.innerHTML = ''; el.classList.remove('show'); } }

// ── LIMPEZA AUTOMÁTICA DE ERROS AO DIGITAR ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Etapa 1
  document.getElementById('nome')?.addEventListener('input', () => { clearErr('err-nome'); unmark('nome'); document.getElementById('banner-step1')?.classList.remove('show'); });
  document.getElementById('bio')?.addEventListener('input',  () => { clearErr('err-bio');  unmark('bio');  document.getElementById('banner-step1')?.classList.remove('show'); });
  document.getElementById('email')?.addEventListener('input',() => { clearErr('err-email');unmark('email');document.getElementById('banner-step1')?.classList.remove('show'); });
  // Etapa 2
  document.getElementById('area')?.addEventListener('change',       () => { clearErr('err-area'); unmark('area');       document.getElementById('banner-step2')?.classList.remove('show'); });
  document.getElementById('instituicao')?.addEventListener('change', () => { clearErr('err-inst'); unmark('instituicao');document.getElementById('banner-step2')?.classList.remove('show'); });
});

/* ── Helpers ──────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function toast(msg, duration = 2500) {
  let el = document.getElementById('__toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '__toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function relativeTime(str) {
  if (!str) return '';
  const diff = Date.now() - new Date(str).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

async function apiFetch(path, opts = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API Error');
  return data;
}

/* ── Shorten Form ─────────────────────────────────────── */
const form       = $('#shorten-form');
const urlInput   = $('#url-input');
const codeInput  = $('#custom-code');
const expiresEl  = $('#expires-days');
const btnText    = $('.btn-text', form);
const btnLoading = $('.btn-loading', form);
const shortenBtn = $('#shorten-btn');
const resultDiv  = $('#result');
const resultUrl  = $('#result-url');
const resultMeta = $('#result-meta');
const errorDiv   = $('#error-msg');
const copyBtn    = $('#copy-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorDiv.classList.add('hidden');
  resultDiv.classList.add('hidden');

  const url         = urlInput.value.trim();
  const custom_code = codeInput.value.trim();
  const expires_in_days = expiresEl.value || undefined;

  shortenBtn.disabled = true;
  btnText.classList.add('hidden');
  btnLoading.classList.remove('hidden');

  try {
    const data = await apiFetch('/shorten', {
      method: 'POST',
      body: JSON.stringify({ url, custom_code: custom_code || undefined, expires_in_days }),
    });

    resultUrl.href = data.short_url;
    resultUrl.textContent = data.short_url;

    const parts = [];
    if (data.is_custom) parts.push('커스텀 코드');
    if (data.expires_at) parts.push(`만료: ${formatDate(data.expires_at)}`);
    resultMeta.textContent = parts.join(' · ');

    resultDiv.classList.remove('hidden');
    urlInput.value = '';
    codeInput.value = '';
    expiresEl.value = '';

    loadList();
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('hidden');
  } finally {
    shortenBtn.disabled = false;
    btnText.classList.remove('hidden');
    btnLoading.classList.add('hidden');
  }
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(resultUrl.href).then(() => toast('✅ 복사되었습니다!'));
});

/* ── URL List ─────────────────────────────────────────── */
const urlList   = $('#url-list');
const refreshBtn = $('#refresh-btn');

refreshBtn.addEventListener('click', loadList);

async function loadList() {
  urlList.innerHTML = '<div class="loading">불러오는 중...</div>';
  try {
    const { urls } = await apiFetch('/urls');
    renderList(urls);
  } catch {
    urlList.innerHTML = '<div class="empty">목록을 불러오지 못했습니다.</div>';
  }
}

function renderList(urls) {
  if (!urls.length) {
    urlList.innerHTML = '<div class="empty">단축된 URL이 없습니다.</div>';
    return;
  }

  urlList.innerHTML = urls.map(u => `
    <div class="url-item" data-code="${u.code}">
      <div class="url-info">
        <a class="url-code" href="/${u.code}" target="_blank" rel="noopener">/${u.code}</a>
        <span class="url-original" title="${u.original_url}">${u.original_url}</span>
        <div class="url-badges">
          <span class="badge badge-${u.status}">${u.status === 'active' ? '✅ 활성' : '⛔ 만료'}</span>
          <span class="badge badge-clicks">👆 ${u.click_count.toLocaleString()}회</span>
          ${u.is_custom ? '<span class="badge badge-custom">⭐ 커스텀</span>' : ''}
          ${u.expires_at ? `<span class="badge badge-expires">⏰ ${formatDate(u.expires_at)}</span>` : ''}
        </div>
      </div>
      <div class="url-actions">
        <button class="btn btn-icon" data-action="stats" data-code="${u.code}" title="통계">📊</button>
        <button class="btn btn-icon" data-action="copy" data-url="${location.origin}/${u.code}" title="복사">📋</button>
        <button class="btn btn-icon btn-danger" data-action="delete" data-code="${u.code}" title="삭제">🗑️</button>
      </div>
    </div>
  `).join('');
}

// Event delegation for list actions
urlList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const { action, code, url: shortUrl } = btn.dataset;

  if (action === 'copy') {
    navigator.clipboard.writeText(shortUrl).then(() => toast('✅ 복사되었습니다!'));
  }

  if (action === 'delete') {
    if (!confirm(`"${code}"를 삭제하시겠습니까?`)) return;
    try {
      await apiFetch(`/urls/${code}`, { method: 'DELETE' });
      toast('🗑️ 삭제되었습니다.');
      loadList();
    } catch (err) {
      toast('❌ ' + err.message);
    }
  }

  if (action === 'stats') {
    openStats(code);
  }
});

/* ── Stats Modal ──────────────────────────────────────── */
const modal      = $('#stats-modal');
const modalTitle = $('#modal-title');
const modalBody  = $('#modal-body');
const modalClose = $('#modal-close');
const overlay    = $('#modal-overlay');

modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function closeModal() { modal.classList.add('hidden'); }

async function openStats(code) {
  modal.classList.remove('hidden');
  modalTitle.textContent = `/${code} 통계`;
  modalBody.innerHTML = '<div class="loading">불러오는 중...</div>';

  try {
    const data = await apiFetch(`/urls/${code}`);
    renderStats(data);
  } catch {
    modalBody.innerHTML = '<div class="empty">통계를 불러오지 못했습니다.</div>';
  }
}

function renderStats(d) {
  // Build click chart (last 30 days)
  const chartHtml = buildChart(d.clicks_by_day || []);

  // Last click
  const lastClick = d.recent_clicks?.[0];

  modalBody.innerHTML = `
    <div class="detail-url">
      <strong>원본 URL:</strong>
      <a href="${d.original_url}" target="_blank" rel="noopener">${d.original_url}</a>
    </div>

    <div class="stat-grid">
      <div class="stat-box">
        <div class="stat-value">${d.click_count.toLocaleString()}</div>
        <div class="stat-label">총 클릭</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${formatDate(d.created_at)}</div>
        <div class="stat-label">생성일</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${d.expires_at ? formatDate(d.expires_at) : '없음'}</div>
        <div class="stat-label">만료일</div>
      </div>
    </div>

    ${chartHtml}

    ${lastClick ? `
      <div class="chart-section" style="margin-top:16px">
        <h4>마지막 방문</h4>
        <div style="font-size:.85rem;color:var(--gray-600)">
          ${relativeTime(lastClick.clicked_at)}
          ${lastClick.referer ? ` · 출처: ${new URL(lastClick.referer).hostname}` : ''}
        </div>
      </div>
    ` : ''}
  `;
}

function buildChart(days) {
  if (!days.length) return '<p style="color:var(--gray-400);font-size:.85rem;margin-top:8px">클릭 데이터가 없습니다.</p>';

  const max = Math.max(...days.map(d => d.count), 1);
  const bars = days.map(d => {
    const pct = Math.round((d.count / max) * 100);
    const label = d.day.slice(5); // MM-DD
    return `
      <div class="chart-bar-wrap" title="${d.day}: ${d.count}회">
        <div class="chart-bar" style="height:${pct}%"></div>
        <div class="chart-bar-label">${label}</div>
      </div>`;
  }).join('');

  return `
    <div class="chart-section">
      <h4>일별 클릭 (최근 30일)</h4>
      <div class="chart-bars">${bars}</div>
    </div>`;
}

/* ── Init ─────────────────────────────────────────────── */
loadList();

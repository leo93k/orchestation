/* ── 탭 전환 ──────────────────────────────────────────────────────────── */
const tabs = document.querySelectorAll('.tab');
const tabContents = { list: document.getElementById('listTab'), stats: document.getElementById('statsTab') };

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab;
    Object.keys(tabContents).forEach(key => {
      tabContents[key].classList.toggle('hidden', key !== target);
    });
    if (target === 'list') loadUrlList();
  });
});

/* ── URL 단축 폼 ──────────────────────────────────────────────────────── */
const shortenForm = document.getElementById('shortenForm');
const resultDiv = document.getElementById('result');
const shortUrlLink = document.getElementById('shortUrlLink');
const resultMeta = document.getElementById('resultMeta');
const formError = document.getElementById('formError');
const submitBtn = document.getElementById('submitBtn');
const copyBtn = document.getElementById('copyBtn');

shortenForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideEl(resultDiv);
  hideEl(formError);

  const url = document.getElementById('url').value.trim();
  const custom_code = document.getElementById('customCode').value.trim() || undefined;
  const expires_in_days = document.getElementById('expiresDays').value
    ? parseInt(document.getElementById('expiresDays').value) : undefined;

  submitBtn.disabled = true;
  submitBtn.textContent = '생성 중...';

  try {
    const data = await apiPost('/api/shorten', { url, custom_code, expires_in_days });
    shortUrlLink.textContent = data.short_url;
    shortUrlLink.href = data.short_url;

    const metaParts = [`생성: ${formatDate(data.created_at)}`];
    if (data.expires_at) metaParts.push(`만료: ${formatDate(data.expires_at)}`);
    if (data.custom_code) metaParts.push('커스텀 코드');
    resultMeta.textContent = metaParts.join(' · ');

    showEl(resultDiv);
    shortenForm.reset();
    loadUrlList();
  } catch (err) {
    showEl(formError);
    formError.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '단축하기';
  }
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shortUrlLink.href);
    copyBtn.textContent = '✅ 복사됨';
    setTimeout(() => { copyBtn.textContent = '📋 복사'; }, 2000);
  } catch {
    copyBtn.textContent = '복사 실패';
  }
});

/* ── URL 목록 ─────────────────────────────────────────────────────────── */
document.getElementById('refreshBtn').addEventListener('click', loadUrlList);

async function loadUrlList() {
  const container = document.getElementById('urlList');
  container.innerHTML = '<div class="empty-state">로딩 중...</div>';
  try {
    const urls = await apiFetch('/api/urls');
    if (!urls.length) {
      container.innerHTML = '<div class="empty-state">아직 생성된 단축 URL이 없습니다.</div>';
      return;
    }
    container.innerHTML = '';
    urls.forEach(item => container.appendChild(renderUrlItem(item)));
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:#ef4444">불러오기 실패: ${err.message}</div>`;
  }
}

function renderUrlItem(item) {
  const el = document.createElement('div');
  el.className = 'url-item' + (item.expired ? ' expired' : '');

  const metaBadges = [
    `<span class="badge badge-click">👆 ${item.click_count}회</span>`,
    `<span class="badge badge-date">📅 ${formatDate(item.created_at)}</span>`,
  ];
  if (item.custom_code) metaBadges.push('<span class="badge badge-custom">커스텀</span>');
  if (item.expires_at && !item.expired) {
    metaBadges.push(`<span class="badge badge-expires">⏰ ${formatDate(item.expires_at)} 만료</span>`);
  }
  if (item.expired) {
    metaBadges.push('<span class="badge badge-expired">만료됨</span>');
  }

  el.innerHTML = `
    <div class="url-item-info">
      <a class="url-item-short" href="${item.short_url}" target="_blank">${item.short_url}</a>
      <div class="url-item-original" title="${escHtml(item.original_url)}">${escHtml(item.original_url)}</div>
      <div class="url-item-meta">${metaBadges.join('')}</div>
    </div>
    <div class="url-item-actions">
      <button class="btn-icon" data-code="${item.short_code}" title="삭제">🗑 삭제</button>
    </div>
  `;

  el.querySelector('.btn-icon').addEventListener('click', async () => {
    if (!confirm('이 URL을 삭제하시겠습니까?')) return;
    try {
      await apiDelete(`/api/urls/${item.short_code}`);
      loadUrlList();
    } catch (err) {
      alert('삭제 실패: ' + err.message);
    }
  });

  return el;
}

/* ── 통계 조회 ────────────────────────────────────────────────────────── */
document.getElementById('statsSearchBtn').addEventListener('click', loadStats);
document.getElementById('statsCode').addEventListener('keydown', e => {
  if (e.key === 'Enter') loadStats();
});

async function loadStats() {
  const code = document.getElementById('statsCode').value.trim();
  const resultEl = document.getElementById('statsResult');
  const errorEl = document.getElementById('statsError');
  hideEl(resultEl);
  hideEl(errorEl);

  if (!code) {
    showEl(errorEl);
    errorEl.textContent = '코드를 입력하세요.';
    return;
  }

  try {
    const data = await apiFetch(`/api/stats/${code}`);
    resultEl.innerHTML = `
      <h3>📊 통계: <span style="color:var(--primary)">${data.short_code}</span></h3>
      <div class="stats-grid">
        <div class="stats-item">
          <div class="stats-item-label">총 클릭 수</div>
          <div class="stats-item-value highlight">${data.click_count.toLocaleString()}</div>
        </div>
        <div class="stats-item">
          <div class="stats-item-label">생성일</div>
          <div class="stats-item-value">${formatDate(data.created_at)}</div>
        </div>
        <div class="stats-item">
          <div class="stats-item-label">만료일</div>
          <div class="stats-item-value">${data.expires_at ? formatDate(data.expires_at) : '없음'}</div>
        </div>
        <div class="stats-item">
          <div class="stats-item-label">상태</div>
          <div class="stats-item-value" style="color:${data.expired ? 'var(--danger)' : 'var(--success)'}">
            ${data.expired ? '만료됨' : '활성'}
          </div>
        </div>
        <div class="stats-item">
          <div class="stats-item-label">코드 유형</div>
          <div class="stats-item-value">${data.custom_code ? '커스텀' : '자동생성'}</div>
        </div>
      </div>
      <div class="stats-original">원본 URL: <a href="${data.original_url}" target="_blank">${escHtml(data.original_url)}</a></div>
    `;
    showEl(resultEl);
  } catch (err) {
    showEl(errorEl);
    errorEl.textContent = err.message;
  }
}

/* ── API 헬퍼 ─────────────────────────────────────────────────────────── */
async function apiFetch(url) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `오류 (${res.status})`);
  return json;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `오류 (${res.status})`);
  return json;
}

async function apiDelete(url) {
  const res = await fetch(url, { method: 'DELETE' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `오류 (${res.status})`);
  return json;
}

/* ── UI 유틸 ──────────────────────────────────────────────────────────── */
function showEl(el) { el.classList.remove('hidden'); }
function hideEl(el) { el.classList.add('hidden'); }
function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/* ── 초기 로드 ────────────────────────────────────────────────────────── */
loadUrlList();

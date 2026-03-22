const BASE = window.location.origin;

function getShortUrl(code) {
  return `${BASE}/${code}`;
}

function formatDate(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// 폼 제출
document.getElementById('createForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const resultBox = document.getElementById('resultBox');
  const errorBox = document.getElementById('errorBox');
  resultBox.classList.add('hidden');
  errorBox.classList.add('hidden');

  const original_url = document.getElementById('originalUrl').value.trim();
  const custom_code = document.getElementById('customCode').value.trim();
  const expires_in_days = document.getElementById('expiresIn').value;

  const body = { original_url };
  if (custom_code) body.custom_code = custom_code;
  if (expires_in_days) body.expires_in_days = expires_in_days;

  try {
    const res = await fetch('/api/urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      errorBox.textContent = data.error || '오류가 발생했습니다.';
      errorBox.classList.remove('hidden');
      return;
    }

    const shortUrl = getShortUrl(data.short_code);
    const resultLink = document.getElementById('resultLink');
    resultLink.href = shortUrl;
    resultLink.textContent = shortUrl;
    document.getElementById('copyMsg').classList.add('hidden');
    resultBox.classList.remove('hidden');

    // 폼 초기화 (URL 제외)
    document.getElementById('customCode').value = '';
    document.getElementById('expiresIn').value = '';

    loadUrls();
  } catch (err) {
    errorBox.textContent = '서버 연결 오류가 발생했습니다.';
    errorBox.classList.remove('hidden');
  }
});

// 복사 버튼
function copyResult() {
  const link = document.getElementById('resultLink').href;
  navigator.clipboard.writeText(link).then(() => {
    const msg = document.getElementById('copyMsg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2000);
  });
}

// URL 목록 로드
async function loadUrls() {
  const listEl = document.getElementById('urlList');
  listEl.innerHTML = '<p class="loading">불러오는 중...</p>';

  try {
    const res = await fetch('/api/urls');
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      listEl.innerHTML = '<p class="empty">아직 생성된 단축 URL이 없습니다.</p>';
      return;
    }

    listEl.innerHTML = data.map(item => {
      const shortUrl = getShortUrl(item.short_code);
      const expired = isExpired(item.expires_at);
      const expiresLabel = item.expires_at
        ? `<span class="badge ${expired ? 'badge-expired' : 'badge-expires'}">⏱ ${expired ? '만료됨' : formatDate(item.expires_at) + ' 까지'}</span>`
        : '';

      return `
        <div class="url-item" id="item-${item.short_code}">
          <div class="url-item-header">
            <a class="url-short" href="${shortUrl}" target="_blank">${shortUrl}</a>
            <div class="url-meta">
              <span class="badge badge-clicks">👆 ${item.clicks.toLocaleString()}회</span>
              ${expiresLabel}
              <button class="btn btn-danger" onclick="deleteUrl('${item.short_code}')">삭제</button>
            </div>
          </div>
          <div class="url-original" title="${escapeHtml(item.original_url)}">→ ${escapeHtml(item.original_url)}</div>
          <div class="url-date">생성: ${formatDate(item.created_at)}</div>
        </div>
      `;
    }).join('');
  } catch (err) {
    listEl.innerHTML = '<p class="loading">목록을 불러오지 못했습니다.</p>';
  }
}

// 삭제
async function deleteUrl(code) {
  if (!confirm(`"${code}" 단축 URL을 삭제하시겠습니까?`)) return;
  try {
    const res = await fetch(`/api/urls/${code}`, { method: 'DELETE' });
    if (res.ok) {
      const el = document.getElementById(`item-${code}`);
      if (el) el.remove();
      const list = document.getElementById('urlList');
      if (!list.querySelector('.url-item')) {
        list.innerHTML = '<p class="empty">아직 생성된 단축 URL이 없습니다.</p>';
      }
    }
  } catch (err) {
    alert('삭제 중 오류가 발생했습니다.');
  }
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// 초기 로드
loadUrls();

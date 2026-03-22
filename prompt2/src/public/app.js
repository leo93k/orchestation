const API = '/api';

// DOM elements
const form = document.getElementById('shortenForm');
const urlInput = document.getElementById('urlInput');
const aliasInput = document.getElementById('aliasInput');
const expiresSelect = document.getElementById('expiresSelect');
const result = document.getElementById('result');
const shortUrlDisplay = document.getElementById('shortUrlDisplay');
const copyBtn = document.getElementById('copyBtn');
const visitBtn = document.getElementById('visitBtn');
const urlTableBody = document.getElementById('urlTableBody');
const statsModal = document.getElementById('statsModal');
const statsContent = document.getElementById('statsContent');

// Shorten URL
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const url = urlInput.value.trim();
  const customAlias = aliasInput.value.trim() || undefined;
  const expiresIn = parseInt(expiresSelect.value) || undefined;

  try {
    const res = await fetch(`${API}/shorten`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, customAlias, expiresIn }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Error creating short URL');
      return;
    }

    shortUrlDisplay.textContent = data.shortUrl;
    visitBtn.href = data.shortUrl;
    result.classList.add('show');

    urlInput.value = '';
    aliasInput.value = '';
    expiresSelect.value = '0';

    loadUrls();
  } catch (err) {
    alert('서버 연결 오류');
  }
});

// Copy to clipboard
copyBtn.addEventListener('click', async () => {
  const text = shortUrlDisplay.textContent;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = '복사됨!';
    setTimeout(() => (copyBtn.textContent = '복사'), 1500);
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    copyBtn.textContent = '복사됨!';
    setTimeout(() => (copyBtn.textContent = '복사'), 1500);
  }
});

// Load URL list
async function loadUrls() {
  try {
    const res = await fetch(`${API}/urls`);
    const urls = await res.json();

    if (urls.length === 0) {
      urlTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">아직 단축 URL이 없습니다.</td></tr>';
      return;
    }

    urlTableBody.innerHTML = urls
      .map((u) => {
        const code = u.displayCode;
        const shortUrl = `${location.origin}/${code}`;
        const originalTruncated = u.original_url.length > 40
          ? u.original_url.substring(0, 40) + '...'
          : u.original_url;
        const created = new Date(u.created_at).toLocaleDateString('ko-KR');

        let statusBadge;
        if (!u.expires_at) {
          statusBadge = '<span class="badge badge-none">무기한</span>';
        } else if (u.isExpired) {
          statusBadge = '<span class="badge badge-expired">만료</span>';
        } else {
          statusBadge = '<span class="badge badge-active">활성</span>';
        }

        return `
          <tr>
            <td><a href="${shortUrl}" target="_blank">${code}</a></td>
            <td class="original-url" title="${escapeHtml(u.original_url)}">
              <a href="${escapeHtml(u.original_url)}" target="_blank">${escapeHtml(originalTruncated)}</a>
            </td>
            <td class="clicks-count">${u.clicks}</td>
            <td>${statusBadge}</td>
            <td>${created}</td>
            <td>
              <div class="btn-group">
                <button class="btn btn-sm btn-stats" onclick="showStats('${code}')">통계</button>
                <button class="btn btn-sm btn-delete" onclick="deleteUrl(${u.id})">삭제</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    urlTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">목록을 불러올 수 없습니다.</td></tr>';
  }
}

// Show stats modal
async function showStats(code) {
  try {
    const res = await fetch(`${API}/urls/${code}/stats`);
    const data = await res.json();

    if (!res.ok) {
      alert(data.error);
      return;
    }

    const shortUrl = `${location.origin}/${data.displayCode}`;
    const expires = data.expires_at
      ? new Date(data.expires_at).toLocaleString('ko-KR')
      : '없음';
    const status = !data.expires_at
      ? '무기한'
      : data.isExpired
        ? '만료됨'
        : '활성';

    statsContent.innerHTML = `
      <div class="stat-row">
        <span class="stat-label">단축 URL</span>
        <span class="stat-value"><a href="${shortUrl}" target="_blank">${shortUrl}</a></span>
      </div>
      <div class="stat-row">
        <span class="stat-label">원본 URL</span>
        <span class="stat-value" style="word-break:break-all;max-width:220px;">${escapeHtml(data.original_url)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">총 클릭 수</span>
        <span class="stat-value clicks-count">${data.clicks}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">상태</span>
        <span class="stat-value">${status}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">생성일</span>
        <span class="stat-value">${new Date(data.created_at).toLocaleString('ko-KR')}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">만료일</span>
        <span class="stat-value">${expires}</span>
      </div>
    `;

    statsModal.classList.add('show');
  } catch (err) {
    alert('통계를 불러올 수 없습니다.');
  }
}

// Close modal
function closeModal() {
  statsModal.classList.remove('show');
}

statsModal.addEventListener('click', (e) => {
  if (e.target === statsModal) closeModal();
});

// Delete URL
async function deleteUrl(id) {
  if (!confirm('정말 삭제하시겠습니까?')) return;

  try {
    const res = await fetch(`${API}/urls/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadUrls();
    } else {
      const data = await res.json();
      alert(data.error || 'Error deleting URL');
    }
  } catch {
    alert('삭제 중 오류가 발생했습니다.');
  }
}

// Escape HTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Initial load
loadUrls();

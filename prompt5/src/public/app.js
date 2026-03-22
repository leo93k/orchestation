const API = '/api/urls';

const $ = (sel) => document.querySelector(sel);

// === Shorten Form ===
$('#shorten-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideEl('#result');
  hideEl('#error');

  const url = $('#url').value.trim();
  const customAlias = $('#custom-alias').value.trim() || undefined;
  const expiresInMinutes = $('#expires').value ? parseInt($('#expires').value) : undefined;

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, customAlias, expiresInMinutes }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError('#error', data.error || 'Failed to create short URL');
      return;
    }

    $('#result-link').href = data.shortUrl;
    $('#result-link').textContent = data.shortUrl;
    showEl('#result');
    loadUrls();
  } catch (err) {
    showError('#error', 'Network error');
  }
});

// === Copy Button ===
$('#copy-btn').addEventListener('click', () => {
  const url = $('#result-link').textContent;
  navigator.clipboard.writeText(url).then(() => {
    $('#copy-btn').textContent = '✅';
    setTimeout(() => ($('#copy-btn').textContent = '📋'), 1500);
  });
});

// === URL List ===
async function loadUrls() {
  try {
    const res = await fetch(API);
    const urls = await res.json();
    const tbody = $('#url-tbody');

    if (urls.length === 0) {
      tbody.innerHTML = '';
      showEl('#empty-msg');
      return;
    }

    hideEl('#empty-msg');
    tbody.innerHTML = urls.map(u => `
      <tr>
        <td><a href="/${u.shortCode}" target="_blank">${u.shortCode}</a></td>
        <td class="url-cell" title="${escHtml(u.originalUrl)}">${escHtml(u.originalUrl)}</td>
        <td>${u.clicks}</td>
        <td>${u.expiresAt || '-'}</td>
        <td>${formatDate(u.createdAt)}</td>
      </tr>
    `).join('');
  } catch {
    // silent
  }
}

$('#refresh-btn').addEventListener('click', loadUrls);

// === Stats ===
$('#stats-btn').addEventListener('click', async () => {
  hideEl('#stats-result');
  hideEl('#stats-error');

  const code = $('#stats-code').value.trim();
  if (!code) return;

  try {
    const res = await fetch(`${API}/${code}/stats`);
    const data = await res.json();

    if (!res.ok) {
      showError('#stats-error', data.error || 'Not found');
      return;
    }

    $('#stat-url').textContent = data.originalUrl;
    $('#stat-clicks').textContent = data.clicks;
    $('#stat-created').textContent = formatDate(data.createdAt);
    $('#stat-expires').textContent = data.expiresAt || '-';
    showEl('#stats-result');
  } catch {
    showError('#stats-error', 'Network error');
  }
});

// === Helpers ===
function showEl(sel) { $(sel).classList.remove('hidden'); }
function hideEl(sel) { $(sel).classList.add('hidden'); }
function showError(sel, msg) { $(sel).textContent = msg; showEl(sel); }
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function formatDate(s) { return s ? s.slice(0, 16).replace('T', ' ') : '-'; }

// Initial load
loadUrls();

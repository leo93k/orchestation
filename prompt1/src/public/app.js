'use strict';

const BASE_URL = window.location.origin;

/* ============================
   유틸리티
   ============================ */

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  const duration = 3000;
  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

function setLoading(btn, loading) {
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  if (loading) {
    btn.disabled = true;
    if (text) text.classList.add('hidden');
    if (spinner) spinner.classList.remove('hidden');
  } else {
    btn.disabled = false;
    if (text) text.classList.remove('hidden');
    if (spinner) spinner.classList.add('hidden');
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '없음';
  try {
    return new Date(dateStr).toLocaleString('ko-KR');
  } catch {
    return dateStr;
  }
}

function truncate(str, max = 40) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

/* ============================
   API 호출
   ============================ */

async function apiShortenUrl(url, customCode, expiresIn) {
  const body = { url };
  if (customCode) body.customCode = customCode;
  if (expiresIn) body.expiresIn = Number(expiresIn);

  const res = await fetch(`${BASE_URL}/api/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || '단축 URL 생성에 실패했습니다.');
  return data;
}

async function apiFetchUrls() {
  const res = await fetch(`${BASE_URL}/api/urls`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || '목록을 불러오지 못했습니다.');
  return data;
}

async function apiDeleteUrl(code) {
  const res = await fetch(`${BASE_URL}/api/urls/${code}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.message || '삭제에 실패했습니다.');
  }
}

async function apiFetchStats(code) {
  const res = await fetch(`${BASE_URL}/api/stats/${code}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || '통계를 불러오지 못했습니다.');
  return data;
}

/* ============================
   섹션 1: URL 단축
   ============================ */

function initShortenForm() {
  const form = document.getElementById('shorten-form');
  const btn = document.getElementById('shorten-btn');
  const resultBox = document.getElementById('result-box');
  const resultUrlEl = document.getElementById('result-url');
  const copyBtn = document.getElementById('copy-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const url = form.url.value.trim();
    const customCode = form.customCode.value.trim();
    const expiresIn = form.expiresIn.value;

    if (!url) {
      showToast('원본 URL을 입력해주세요.', 'warning');
      return;
    }

    setLoading(btn, true);
    try {
      const data = await apiShortenUrl(url, customCode, expiresIn);
      const shortUrl = data.shortUrl || `${BASE_URL}/${data.code}`;

      resultUrlEl.textContent = shortUrl;
      resultUrlEl.href = shortUrl;
      resultBox.classList.remove('hidden');
      showToast('단축 URL이 생성되었습니다!', 'success');
      form.reset();

      // 목록 새로고침
      loadUrlList();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  copyBtn.addEventListener('click', async () => {
    const url = resultUrlEl.textContent;
    try {
      await navigator.clipboard.writeText(url);
      showToast('클립보드에 복사되었습니다.', 'success');
    } catch {
      showToast('복사에 실패했습니다. 직접 복사해주세요.', 'warning');
    }
  });
}

/* ============================
   섹션 2: URL 목록
   ============================ */

async function loadUrlList() {
  const tbody = document.getElementById('url-tbody');
  const emptyMsg = document.getElementById('empty-msg');
  const loadingEl = document.getElementById('table-loading');
  const tableEl = document.getElementById('url-table');

  tableEl.classList.add('hidden');
  emptyMsg.classList.add('hidden');
  loadingEl.classList.remove('hidden');

  try {
    const data = await apiFetchUrls();
    const urls = Array.isArray(data) ? data : (data.urls || data.data || []);

    loadingEl.classList.add('hidden');

    if (!urls.length) {
      emptyMsg.classList.remove('hidden');
      return;
    }

    tableEl.classList.remove('hidden');
    tbody.innerHTML = '';

    urls.forEach((item) => {
      const code = item.code || item.shortCode || item.id;
      const shortUrl = item.shortUrl || `${BASE_URL}/${code}`;
      const expiresAt = item.expiresAt || item.expires_at;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="td-original" title="${item.originalUrl || item.url || ''}">
          ${truncate(item.originalUrl || item.url || '', 40)}
        </td>
        <td class="td-short">
          <a href="${shortUrl}" target="_blank" rel="noopener noreferrer">${shortUrl}</a>
        </td>
        <td class="td-clicks">${item.clicks ?? item.clickCount ?? 0}</td>
        <td class="td-expires">${formatDate(expiresAt)}</td>
        <td>
          <button class="btn btn-danger" data-code="${code}">삭제</button>
        </td>
      `;

      const deleteBtn = tr.querySelector('.btn-danger');
      deleteBtn.addEventListener('click', () => handleDelete(code, tr));

      tbody.appendChild(tr);
    });
  } catch (err) {
    loadingEl.classList.add('hidden');
    showToast(err.message, 'error');
  }
}

async function handleDelete(code, tr) {
  if (!confirm(`'${code}' 단축 URL을 삭제하시겠습니까?`)) return;
  try {
    await apiDeleteUrl(code);
    tr.remove();
    showToast('삭제되었습니다.', 'success');

    const tbody = document.getElementById('url-tbody');
    if (!tbody.children.length) {
      document.getElementById('url-table').classList.add('hidden');
      document.getElementById('empty-msg').classList.remove('hidden');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function initUrlList() {
  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.addEventListener('click', () => loadUrlList());
  loadUrlList();
}

/* ============================
   섹션 3: 통계 조회
   ============================ */

function initStats() {
  const statsBtn = document.getElementById('stats-btn');
  const statsCodeInput = document.getElementById('stats-code');
  const statsCards = document.getElementById('stats-cards');

  statsBtn.addEventListener('click', async () => {
    const code = statsCodeInput.value.trim();
    if (!code) {
      showToast('단축 코드를 입력해주세요.', 'warning');
      return;
    }

    setLoading(statsBtn, true);
    statsCards.classList.add('hidden');

    try {
      const data = await apiFetchStats(code);
      const shortUrl = data.shortUrl || `${BASE_URL}/${code}`;
      const expiresAt = data.expiresAt || data.expires_at;
      const createdAt = data.createdAt || data.created_at;

      document.getElementById('stat-original-url').textContent = data.originalUrl || data.url || '-';
      document.getElementById('stat-short-url').textContent = shortUrl;
      document.getElementById('stat-clicks').textContent = data.clicks ?? data.clickCount ?? 0;
      document.getElementById('stat-created-at').textContent = formatDate(createdAt);
      document.getElementById('stat-expires-at').textContent = formatDate(expiresAt);

      statsCards.classList.remove('hidden');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(statsBtn, false);
    }
  });

  // Enter 키 지원
  statsCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') statsBtn.click();
  });
}

/* ============================
   초기화
   ============================ */

document.addEventListener('DOMContentLoaded', () => {
  initShortenForm();
  initUrlList();
  initStats();
});

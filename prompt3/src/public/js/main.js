/**
 * Client-side JavaScript for URL Shortener.
 * Handles form submission via fetch API and clipboard copy.
 */
(function () {
  'use strict';

  // === URL Shortening Form ===
  const form = document.getElementById('shorten-form');
  if (form) {
    const submitBtn = document.getElementById('submit-btn');
    const resultSection = document.getElementById('result-section');
    const errorSection = document.getElementById('error-section');
    const resultUrl = document.getElementById('result-url');
    const resultOriginalUrl = document.getElementById('result-original-url');
    const resultExpires = document.getElementById('result-expires');
    const resultExpiresAt = document.getElementById('result-expires-at');
    const errorMessage = document.getElementById('error-message');
    const copyBtn = document.getElementById('copy-btn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Hide previous results/errors
      resultSection.style.display = 'none';
      errorSection.style.display = 'none';

      // Gather form data
      const url = document.getElementById('url').value.trim();
      const customSlug = document.getElementById('customSlug').value.trim();
      const expiresSelect = document.getElementById('expiresInMinutes').value;
      const expiresInMinutes = expiresSelect ? parseInt(expiresSelect, 10) : null;

      // Disable button during request
      submitBtn.disabled = true;
      submitBtn.textContent = '생성 중...';

      try {
        const body = { url };
        if (customSlug) body.customSlug = customSlug;
        if (expiresInMinutes) body.expiresInMinutes = expiresInMinutes;

        const response = await fetch('/api/urls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
          const msg = data.error?.details
            ? data.error.details.map(d => d.message).join(', ')
            : data.error?.message || 'An error occurred';
          throw new Error(msg);
        }

        // Show result
        resultUrl.href = data.shortUrl;
        resultUrl.textContent = data.shortUrl;
        resultOriginalUrl.textContent = data.originalUrl;

        if (data.expiresAt) {
          resultExpiresAt.textContent = data.expiresAt;
          resultExpires.style.display = 'block';
        } else {
          resultExpires.style.display = 'none';
        }

        resultSection.style.display = 'block';

        // Reset form
        form.reset();
      } catch (err) {
        errorMessage.textContent = err.message;
        errorSection.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '단축 URL 생성';
      }
    });

    // Copy to clipboard
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const url = resultUrl.textContent;
        try {
          await navigator.clipboard.writeText(url);
          copyBtn.textContent = '복사됨!';
          setTimeout(() => {
            copyBtn.textContent = '복사';
          }, 2000);
        } catch {
          // Fallback for older browsers
          const input = document.createElement('input');
          input.value = url;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);
          copyBtn.textContent = '복사됨!';
          setTimeout(() => {
            copyBtn.textContent = '복사';
          }, 2000);
        }
      });
    }
  }

  // === Delete URL buttons (Dashboard) ===
  document.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-btn');
    if (!deleteBtn) return;

    const id = deleteBtn.dataset.id;
    if (!confirm('정말 이 URL을 삭제하시겠습니까?')) return;

    deleteBtn.disabled = true;
    deleteBtn.textContent = '삭제 중...';

    try {
      const response = await fetch(`/api/urls/${id}`, { method: 'DELETE' });

      if (response.ok || response.status === 204) {
        // Remove the table row
        const row = deleteBtn.closest('tr');
        if (row) {
          row.style.opacity = '0';
          row.style.transition = 'opacity 0.3s';
          setTimeout(() => row.remove(), 300);
        }
      } else {
        alert('삭제에 실패했습니다.');
        deleteBtn.disabled = false;
        deleteBtn.textContent = '삭제';
      }
    } catch {
      alert('네트워크 오류가 발생했습니다.');
      deleteBtn.disabled = false;
      deleteBtn.textContent = '삭제';
    }
  });
})();

const urlInput = document.getElementById("url-input");
const fetchBtn = document.getElementById("fetch-btn");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const resultTitle = document.getElementById("result-title");
const resultUrl = document.getElementById("result-url");
const copyRichBtn = document.getElementById("copy-rich-btn");
const copyMdBtn = document.getElementById("copy-md-btn");

let currentResult = null;

function isGitHubUrl(text) {
  try {
    const u = new URL(text.trim());
    return u.hostname === "github.com";
  } catch {
    return false;
  }
}

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove("hidden");
}

function hideStatus() {
  statusEl.classList.add("hidden");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchTitle() {
  const url = urlInput.value.trim();
  if (!url) return;

  if (!isGitHubUrl(url)) {
    showStatus("GitHub URLを入力してください", "error");
    return;
  }

  resultEl.classList.add("hidden");
  currentResult = null;
  showStatus("取得中...", "loading");
  fetchBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({ type: "fetchTitle", url });

    if (!response.success) {
      showStatus(response.message || "取得に失敗しました", "error");
      return;
    }

    currentResult = response;
    resultTitle.textContent = response.title;
    resultUrl.textContent = response.url;
    resultEl.classList.remove("hidden");

    if (response.fallback) {
      showStatus(`フォールバック: ${response.fallbackReason}`, "warning");
    } else {
      hideStatus();
    }
  } catch (err) {
    showStatus(`エラー: ${err.message}`, "error");
  } finally {
    fetchBtn.disabled = false;
  }
}

async function copyAsRichText() {
  if (!currentResult) return;
  const { title, url } = currentResult;
  const html = `<a href="${escapeHtml(url)}">${escapeHtml(title)}</a>`;

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([title], { type: "text/plain" })
      })
    ]);
    showStatus("リンクをコピーしました", "success");
  } catch (err) {
    showStatus(`コピー失敗: ${err.message}`, "error");
  }
}

async function copyAsMarkdown() {
  if (!currentResult) return;
  const { title, url } = currentResult;
  const md = `[${title}](${url})`;

  try {
    await navigator.clipboard.writeText(md);
    showStatus("Markdownをコピーしました", "success");
  } catch (err) {
    showStatus(`コピー失敗: ${err.message}`, "error");
  }
}

fetchBtn.addEventListener("click", fetchTitle);
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") fetchTitle();
});
copyRichBtn.addEventListener("click", copyAsRichText);
copyMdBtn.addEventListener("click", copyAsMarkdown);

// Auto-detect GitHub URL from clipboard on open
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (isGitHubUrl(text)) {
      urlInput.value = text.trim();
      fetchTitle();
    }
  } catch {
    // Clipboard read failed — silently ignore, user can type manually
  }
});

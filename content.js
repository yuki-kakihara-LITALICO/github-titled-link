(() => {
  if (location.hostname === "github.com") return;

  const GITHUB_URL_RE = /https?:\/\/github\.com\/[\w.-]+\/[\w.-]+[^\s<>"')\]},]*/g;

  let popupHost = null;
  let lastClickTime = 0;

  function isGitHubUrl(str) {
    try {
      const u = new URL(str);
      return u.hostname === "github.com" && u.pathname.split("/").filter(Boolean).length >= 2;
    } catch {
      return false;
    }
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function removePopup() {
    if (popupHost) {
      popupHost.remove();
      popupHost = null;
    }
  }

  // Find a GitHub URL from a clicked <a> element
  function findGitHubUrlFromClick(target) {
    const link = target.closest?.("a");
    if (link && isGitHubUrl(link.href)) {
      return { url: link.href, anchor: link };
    }
    return null;
  }

  // Find a GitHub URL inside a DOM subtree (for dynamically added popups)
  function findGitHubUrlInTree(el) {
    if (!el.querySelectorAll) return null;

    // Check <a> elements
    const links = el.querySelectorAll('a[href*="github.com"]');
    for (const link of links) {
      if (isGitHubUrl(link.href)) {
        return { url: link.href, anchor: link };
      }
    }

    // Check text content for GitHub URL patterns
    const text = el.textContent || "";
    GITHUB_URL_RE.lastIndex = 0;
    const m = GITHUB_URL_RE.exec(text);
    if (m && isGitHubUrl(m[0])) {
      return { url: m[0], anchor: el };
    }
    return null;
  }

  function showPopup(url, anchor) {
    removePopup();

    popupHost = document.createElement("div");
    popupHost.style.cssText = "all:initial; position:absolute; z-index:2147483647;";
    const shadow = popupHost.attachShadow({ mode: "closed" });

    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .gtl-popup {
          position: fixed;
          z-index: 2147483647;
          background: #fff;
          border: 1px solid #d0d7de;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          padding: 4px 6px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          font-size: 13px;
          white-space: nowrap;
          display: flex;
          align-items: center;
          animation: gtl-fadein 0.15s ease;
        }
        @keyframes gtl-fadein {
          from { opacity: 0; transform: translateY(2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        button {
          all: unset;
          cursor: pointer;
          padding: 4px 10px;
          border-radius: 6px;
          background: #f6f8fa;
          border: 1px solid #d0d7de;
          font-size: 13px;
          font-weight: 500;
          color: #24292f;
          white-space: nowrap;
          font-family: inherit;
          line-height: 1.4;
        }
        button:hover { background: #eaeef2; }
        button:disabled { opacity: 0.6; cursor: default; }
        button.success { background: #dafbe1; color: #116329; border-color: #aceebb; }
        button.error { background: #ffebe9; color: #cf222e; border-color: #ffcecb; }
      </style>
      <div class="gtl-popup">
        <button class="copy-btn">\u30BF\u30A4\u30C8\u30EB\u3092\u30B3\u30D4\u30FC</button>
      </div>
    `;

    document.body.appendChild(popupHost);

    const popupEl = shadow.querySelector(".gtl-popup");
    const btn = shadow.querySelector(".copy-btn");

    // Position next to the anchor element
    const rect = anchor.getBoundingClientRect();
    popupEl.style.left = `${rect.right + 8}px`;
    popupEl.style.top = `${rect.top + (rect.height - 30) / 2}px`;

    // Adjust if off-screen
    requestAnimationFrame(() => {
      const pr = popupEl.getBoundingClientRect();
      if (pr.right > window.innerWidth - 8) {
        popupEl.style.left = `${rect.left - pr.width - 8}px`;
      }
      if (pr.bottom > window.innerHeight - 8) {
        popupEl.style.top = `${window.innerHeight - pr.height - 8}px`;
      }
      if (pr.top < 8) {
        popupEl.style.top = "8px";
      }
    });

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();

      btn.textContent = "\u53D6\u5F97\u4E2D...";
      btn.disabled = true;

      try {
        const resp = await chrome.runtime.sendMessage({ type: "fetchTitle", url });

        if (resp.success) {
          const html = `<a href="${escapeHtml(url)}">${escapeHtml(resp.title)}</a>`;
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/html": new Blob([html], { type: "text/html" }),
              "text/plain": new Blob([resp.title], { type: "text/plain" })
            })
          ]);
          btn.textContent = "\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F\uFF01";
          btn.classList.add("success");
          setTimeout(removePopup, 1500);
        } else {
          btn.textContent = resp.message || "\u30A8\u30E9\u30FC";
          btn.classList.add("error");
          resetBtn(btn);
        }
      } catch {
        btn.textContent = "\u30A8\u30E9\u30FC";
        btn.classList.add("error");
        resetBtn(btn);
      }
    });

    // Dismiss on outside click
    const dismiss = (e) => {
      if (popupHost && !popupHost.contains(e.composedPath()[0])) {
        removePopup();
        document.removeEventListener("mousedown", dismiss, true);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", dismiss, true), 100);
  }

  function resetBtn(btn) {
    setTimeout(() => {
      btn.textContent = "\u30BF\u30A4\u30C8\u30EB\u3092\u30B3\u30D4\u30FC";
      btn.className = "copy-btn";
      btn.disabled = false;
    }, 2000);
  }

  // --- Trigger 1: Click on <a> with GitHub URL ---
  document.addEventListener("click", (e) => {
    lastClickTime = Date.now();
    const result = findGitHubUrlFromClick(e.target);
    if (result) {
      showPopup(result.url, result.anchor);
    }
  }, true);

  // --- Trigger 2: MutationObserver for dynamic popups (Google Docs link preview, etc.) ---
  const processedNodes = new WeakSet();

  const observer = new MutationObserver((mutations) => {
    // Only react within 2 seconds of a user click
    if (Date.now() - lastClickTime > 2000) return;
    // Don't show if we already have a popup
    if (popupHost) return;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node === popupHost) continue;
        if (processedNodes.has(node)) continue;
        processedNodes.add(node);

        const result = findGitHubUrlInTree(node);
        if (result) {
          showPopup(result.url, result.anchor);
          return;
        }
      }
    }
  });

  const startObserving = () => {
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.body) {
    startObserving();
  } else {
    document.addEventListener("DOMContentLoaded", startObserving);
  }
})();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "fetchTitle") {
    fetchGitHubTitle(message.url).then(sendResponse);
    return true; // keep message channel open for async response
  }
});

async function fetchGitHubTitle(url) {
  try {
    const cookies = await chrome.cookies.getAll({ domain: "github.com" });
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        "Cookie": cookieHeader,
        "User-Agent": "Mozilla/5.0 (compatible; GitHubTitledLink/1.0)"
      },
      signal: controller.signal,
      redirect: "manual"
    });

    clearTimeout(timeout);

    // Detect login redirect
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location") || "";
      if (location.includes("/login") || location.includes("/session")) {
        return { success: false, error: "auth", message: "GitHub\u306B\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044" };
      }
    }

    if (response.status === 429) {
      return { success: false, error: "rate_limit", message: "Rate limit\u306B\u9054\u3057\u307E\u3057\u305F\u3002\u5C11\u3057\u5F85\u3063\u3066\u304B\u3089\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044" };
    }

    if (!response.ok) {
      return fallback(url, `HTTP ${response.status}`);
    }

    const html = await response.text();

    // Detect login page in response body
    if (html.includes('<meta name="login"') || html.includes('action="/session"')) {
      return { success: false, error: "auth", message: "GitHub\u306B\u30ED\u30B0\u30A4\u30F3\u3057\u3066\u304F\u3060\u3055\u3044" };
    }

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (!titleMatch) {
      return fallback(url, "Title not found");
    }

    const rawTitle = decodeHTMLEntities(titleMatch[1].trim());
    const title = cleanTitle(rawTitle, url);

    return { success: true, title, url };
  } catch (err) {
    if (err.name === "AbortError") {
      return fallback(url, "\u30BF\u30A4\u30E0\u30A2\u30A6\u30C8\u3057\u307E\u3057\u305F");
    }
    return fallback(url, err.message);
  }
}

function cleanTitle(title, url) {
  // "GitHub - owner/repo: desc" → "owner/repo: desc"
  if (title.startsWith("GitHub - ")) {
    return title.slice("GitHub - ".length);
  }

  // "Title · Issue #123 · owner/repo" → "Title (owner/repo#123)"
  const issueMatch = title.match(/^(.+?)\s+·\s+Issue #(\d+)\s+·\s+(.+)$/);
  if (issueMatch) {
    return `${issueMatch[1].trim()} (${issueMatch[3].trim()}#${issueMatch[2]})`;
  }

  // "Title · Pull Request #456 · owner/repo" → "Title (owner/repo#456)"
  const prMatch = title.match(/^(.+?)\s+·\s+Pull Request #(\d+)\s+·\s+(.+)$/);
  if (prMatch) {
    return `${prMatch[1].trim()} (${prMatch[3].trim()}#${prMatch[2]})`;
  }

  // "repo/path at branch · owner/repo" → "path (owner/repo@branch)"
  const fileMatch = title.match(/^(.+?)\s+at\s+(.+?)\s+·\s+(.+)$/);
  if (fileMatch) {
    const fullPath = fileMatch[1].trim();
    const branch = fileMatch[2].trim();
    const ownerRepo = fileMatch[3].trim();
    // fullPath is "repo/path" — strip the repo name prefix
    const repoName = ownerRepo.split("/")[1];
    const path = repoName && fullPath.startsWith(repoName + "/")
      ? fullPath.slice(repoName.length + 1)
      : fullPath;
    return `${path} (${ownerRepo}@${branch})`;
  }

  return title;
}

function decodeHTMLEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function fallback(url, reason) {
  const title = titleFromUrl(url);
  return { success: true, title, url, fallback: true, fallbackReason: reason };
}

function titleFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);

    if (parts.length < 2) return u.pathname;

    const owner = parts[0];
    const repo = parts[1];

    // /owner/repo/issues/123
    if (parts[2] === "issues" && parts[3]) {
      return `${owner}/${repo}#${parts[3]}`;
    }
    // /owner/repo/pull/456
    if (parts[2] === "pull" && parts[3]) {
      return `${owner}/${repo}#${parts[3]}`;
    }
    // /owner/repo/commit/sha
    if (parts[2] === "commit" && parts[3]) {
      return `${owner}/${repo}@${parts[3].slice(0, 7)}`;
    }
    // /owner/repo/blob/branch/path or /owner/repo/tree/branch/path
    if ((parts[2] === "blob" || parts[2] === "tree") && parts.length >= 4) {
      const branch = parts[3];
      const path = parts.slice(4).join("/");
      if (path) {
        return `${path} (${owner}/${repo}@${branch})`;
      }
      return `${owner}/${repo}@${branch}`;
    }

    // /owner/repo
    return `${owner}/${repo}`;
  } catch {
    return url;
  }
}

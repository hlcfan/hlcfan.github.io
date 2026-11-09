// Fetches posts.json, post pages and the search index, and caches them in memory.
import { htmlToText } from "./terminal/html-to-text.js";
import { asciify, wrap } from "./terminal/text.js";

export function createContent({ base = "", fetchFn = (...a) => fetch(...a), origin = location.href } = {}) {
  let postsPromise = null;
  let indexPromise = null;
  const pages = new Map();

  return { loadPosts, searchIndex, readPost };

  function loadPosts() {
    postsPromise ??= getJson(`${base}/posts.json`).catch((e) => {
      postsPromise = null;
      throw e;
    });
    return postsPromise;
  }

  function searchIndex(signal) {
    indexPromise ??= getJson(`${base}/search-index.json`, signal).catch((e) => {
      indexPromise = null;
      throw e;
    });
    return indexPromise;
  }

  // Returns {out, label} or {err}. The text is wrapped to `cols`.
  async function readPost(post, cols, signal) {
    const url = base + post.url;
    let html = pages.get(url);
    if (html === undefined) {
      const res = await fetchFn(url, { signal });
      if (!res.ok) return { err: `cat: could not fetch ${url} (${res.status})` };
      html = await res.text();
      pages.set(url, html);
    }
    const doc = new DOMParser().parseFromString(html, "text/html");
    const body = doc.querySelector(".post-content");
    if (!body) return { err: `cat: no post body found. Open ${url}` };

    const text = htmlToText(body, { cols, base: new URL(url, origin).href });
    const title = asciify(post.title).toUpperCase();
    const head = wrap(title, cols);
    const rule = "=".repeat(Math.min(cols, Math.max(...head.map((l) => l.length))));
    return { out: [...head, rule, post.date, "", text].join("\n"), label: post.title };
  }

  async function getJson(url, signal) {
    const res = await fetchFn(url, { signal });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return res.json();
  }
}

// Pages live at real paths under /admin (e.g. /admin/stock, /admin/car/12), served by the
// website's /admin route. Links are plain <a href="/admin/..."> and are handled here without a
// full page load; navigate() does the same from code.

export const BASE = "/admin";

export function navigate(url) {
  if (url === window.location.pathname + window.location.search) return;
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// The page part of the address: "stock", "car/12", "invoices" ("" for the home page).
export function currentPage() {
  const path = window.location.pathname;
  return (path.startsWith(BASE) ? path.slice(BASE.length) : path).replace(/^\/+|\/+$/g, "");
}

// Clicks on same-site /admin links stay in the app (but not API files, downloads or new tabs).
export function interceptLinks() {
  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith(BASE)) return;
    if (url.pathname.startsWith(`${BASE}/api/`)) return;
    e.preventDefault();
    navigate(url.pathname + url.search);
  };
  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}

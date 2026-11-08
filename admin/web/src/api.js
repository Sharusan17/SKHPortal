// Thin wrapper over fetch for the Python API. Errors carry the server's "detail" message.

async function request(method, url, body) {
  const opts = { method, headers: {} };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (res.status === 401) window.dispatchEvent(new Event("auth-required")); // session ended
  if (!res.ok) {
    const detail = data && data.detail;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${res.status})`);
  }
  return data;
}

const withQuery = (url, params) =>
  params ? `${url}?${new URLSearchParams(params).toString()}` : url;

export const api = {
  get: (url, params) => request("GET", withQuery(url, params)),
  post: (url, body, params) => request("POST", withQuery(url, params), body),
  put: (url, body) => request("PUT", url, body),
  patch: (url, body) => request("PATCH", url, body),
  del: (url, params) => request("DELETE", withQuery(url, params)),
};

// Downloads come back with Content-Disposition: attachment, so navigating saves the file.
export function download(url, params) {
  const a = document.createElement("a");
  a.href = withQuery(url, params);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

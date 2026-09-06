// Minimal cookie-aware HTTP client for exercising the API with global
// fetch (Node 20+) — plays the role a browser's cookie jar would play,
// since fetch() itself doesn't persist cookies between calls.
export class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookie = null;
  }

  async request(method, path, { body, formData, headers = {} } = {}) {
    const opts = { method, headers: { ...headers } };
    if (this.cookie) opts.headers.cookie = this.cookie;

    if (formData) {
      opts.body = formData; // fetch sets the multipart content-type + boundary itself
    } else if (body !== undefined) {
      opts.headers['content-type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(`${this.baseUrl}${path}`, opts);

    const setCookies = typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
    if (setCookies.length) {
      this.cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
    }

    const text = await res.text();
    let json = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }
    return { status: res.status, headers: res.headers, body: json };
  }

  get(path, opts) {
    return this.request('GET', path, opts);
  }

  post(path, body, opts = {}) {
    return this.request('POST', path, { body, ...opts });
  }

  patch(path, body, opts = {}) {
    return this.request('PATCH', path, { body, ...opts });
  }

  delete(path, opts) {
    return this.request('DELETE', path, opts);
  }

  clearCookie() {
    this.cookie = null;
  }
}

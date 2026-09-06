// Minimal hand-rolled OAuth2 (no passport) — both providers speak plain
// authorization-code OAuth2, so one shared shape covers them.

function callbackUrl(provider) {
  const base = process.env.APP_BASE_URL || 'http://localhost:8000';
  return `${base}/api/auth/${provider}/callback`;
}

export const providers = {
  google: {
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    scope: 'openid email profile',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    async fetchProfile(accessToken) {
      const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`google userinfo failed: ${res.status}`);
      const data = await res.json();
      return {
        providerId: data.sub,
        email: data.email || null,
        name: data.name || data.email,
        profilePictureUrl: data.picture || null,
      };
    },
  },

  // Instagram API with Instagram Login. Requires an Instagram professional
  // (business/creator) account and a Meta app configured as described in
  // ExternalSetup.md — Instagram does not return an email address.
  instagram: {
    clientId: () => process.env.INSTAGRAM_CLIENT_ID,
    clientSecret: () => process.env.INSTAGRAM_CLIENT_SECRET,
    scope: 'instagram_business_basic',
    authorizeUrl: 'https://www.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    async fetchProfile(accessToken, userId) {
      const url = `https://graph.instagram.com/${userId}?fields=id,username,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`instagram profile failed: ${res.status}`);
      const data = await res.json();
      return {
        providerId: String(data.id),
        email: null,
        name: data.username,
        profilePictureUrl: data.profile_picture_url || null,
      };
    },
  },
};

export function buildAuthorizeUrl(providerName, state) {
  const provider = providers[providerName];
  const url = new URL(provider.authorizeUrl);
  url.searchParams.set('client_id', provider.clientId());
  url.searchParams.set('redirect_uri', callbackUrl(providerName));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', provider.scope);
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCodeForProfile(providerName, code) {
  const provider = providers[providerName];
  const redirectUri = callbackUrl(providerName);

  const body = new URLSearchParams({
    client_id: provider.clientId(),
    client_secret: provider.clientSecret(),
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });
  const tokenRes = await fetch(provider.tokenUrl, { method: 'POST', body });

  if (!tokenRes.ok) {
    throw new Error(`${providerName} token exchange failed: ${tokenRes.status}`);
  }
  const tokenData = await tokenRes.json();
  return provider.fetchProfile(tokenData.access_token, tokenData.user_id);
}

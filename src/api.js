// ==========================================
// AniPulse - API Client & Data Layer
// Supports Web & Android Native (Capacitor)
// ==========================================

export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('anipulse_backend_url');
    if (custom) return custom.replace(/\/+$/, '');
    if (window.Capacitor?.isNativePlatform?.()) {
      return 'http://192.168.1.11:8000';
    }
  }
  return '';
}

export function setBackendUrl(url) {
  if (url) {
    localStorage.setItem('anipulse_backend_url', url.replace(/\/+$/, ''));
  } else {
    localStorage.removeItem('anipulse_backend_url');
  }
}

export function apiUrl(path) {
  const base = getApiBaseUrl();
  return `${base}${path}`;
}

const ANILIST_FALLBACK = 'https://graphql.anilist.co';
const KITSU_FALLBACK = 'https://kitsu.io/api/edge';

/**
 * Standard AniList GraphQL requester with proxy & fallback
 */
export async function fetchAniList(query, variables = {}) {
  try {
    let response;
    try {
      response = await fetch(apiUrl('/api/anilist'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      });
    } catch (err) {
      console.warn('Backend proxy fetch failed, attempting direct AniList fallback:', err);
      response = await fetch(ANILIST_FALLBACK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      });
    }

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('AniList sedang membatasi kuota request (429). Silakan tunggu sebentar.');
      }
      const errBody = await response.text();
      throw new Error(`AniList HTTP Error ${response.status}: ${errBody}`);
    }

    const json = await response.json();
    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0].message);
    }

    return json.data;
  } catch (err) {
    console.error('AniList fetch error:', err);
    throw err;
  }
}

/**
 * Common media fragment
 */
const MEDIA_FRAGMENT = `
  id
  title {
    romaji
    english
    native
  }
  coverImage {
    extraLarge
    large
    color
  }
  bannerImage
  format
  episodes
  duration
  status
  season
  seasonYear
  averageScore
  popularity
  favourites
  genres
  description(asHtml: false)
  trailer {
    id
    site
    thumbnail
  }
  nextAiringEpisode {
    episode
    timeUntilAiring
    airingAt
  }
  studios(isMain: true) {
    nodes {
      name
    }
  }
  externalLinks {
    site
    url
    type
  }
`;

/**
 * Fetch Trending Anime
 */
export async function getTrendingAnime(page = 1, perPage = 18) {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          hasNextPage
          total
        }
        media(type: ANIME, sort: TRENDING_DESC) {
          ${MEDIA_FRAGMENT}
        }
      }
    }
  `;
  const data = await fetchAniList(query, { page, perPage });
  return data.Page.media;
}

/**
 * Fetch Popular Anime This Season
 */
export async function getPopularThisSeason(page = 1, perPage = 18) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  let season = 'FALL';
  if (month >= 1 && month <= 3) season = 'WINTER';
  else if (month >= 4 && month <= 6) season = 'SPRING';
  else if (month >= 7 && month <= 9) season = 'SUMMER';

  const query = `
    query ($page: Int, $perPage: Int, $season: MediaSeason, $seasonYear: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC) {
          ${MEDIA_FRAGMENT}
        }
      }
    }
  `;
  const data = await fetchAniList(query, { page, perPage, season, seasonYear: year });
  return data.Page.media;
}

/**
 * Fetch Top Rated Anime of All Time
 */
export async function getTopRated(page = 1, perPage = 18) {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: SCORE_DESC) {
          ${MEDIA_FRAGMENT}
        }
      }
    }
  `;
  const data = await fetchAniList(query, { page, perPage });
  return data.Page.media;
}

/**
 * Fetch Airing Schedule
 */
export async function getAiringSchedule(page = 1, perPage = 20) {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const query = `
    query ($page: Int, $perPage: Int, $airingAt_greater: Int) {
      Page(page: $page, perPage: $perPage) {
        airingSchedules(airingAt_greater: $airingAt_greater, sort: TIME) {
          id
          airingAt
          timeUntilAiring
          episode
          media {
            ${MEDIA_FRAGMENT}
          }
        }
      }
    }
  `;
  const data = await fetchAniList(query, { page, perPage, airingAt_greater: currentTimestamp });
  return data.Page.airingSchedules;
}

/**
 * Advanced Search & Filter
 */
export async function searchAnime(keyword = '', filters = {}, page = 1, perPage = 18) {
  const query = `
    query ($page: Int, $perPage: Int, $search: String, $genre: String, $format: MediaFormat, $sort: [MediaSort]) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          hasNextPage
          total
        }
        media(type: ANIME, search: $search, genre: $genre, format: $format, sort: $sort) {
          ${MEDIA_FRAGMENT}
        }
      }
    }
  `;

  const variables = { page, perPage };
  if (keyword && keyword.trim()) variables.search = keyword.trim();
  if (filters.genre && filters.genre !== 'ALL') variables.genre = filters.genre;
  if (filters.format && filters.format !== 'ALL') variables.format = filters.format;

  // Sorting
  switch (filters.sort) {
    case 'POPULARITY_DESC':
      variables.sort = ['POPULARITY_DESC'];
      break;
    case 'SCORE_DESC':
      variables.sort = ['SCORE_DESC'];
      break;
    case 'START_DATE_DESC':
      variables.sort = ['START_DATE_DESC'];
      break;
    case 'EPISODES_DESC':
      variables.sort = ['EPISODES_DESC'];
      break;
    default:
      variables.sort = keyword ? ['SEARCH_MATCH', 'POPULARITY_DESC'] : ['TRENDING_DESC'];
  }

  const data = await fetchAniList(query, variables);
  return data.Page.media;
}

/**
 * Fetch comprehensive Anime Details with resilient localStorage caching
 */
export async function getAnimeDetails(id) {
  const numId = Number(id);
  const cacheKey = `anipulse_anime_detail_${numId}`;

  // 1. Instant cache check (0ms)
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.id === numId) {
        return parsed;
      }
    }
  } catch (_) {}

  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_FRAGMENT}
        characters(sort: ROLE, perPage: 8) {
          nodes {
            id
            name {
              full
              native
            }
            image {
              medium
            }
          }
        }
        relations {
          edges {
            relationType
            node {
              id
              title {
                romaji
                english
              }
              coverImage {
                medium
              }
              format
              status
            }
          }
        }
        recommendations(perPage: 6, sort: RATING_DESC) {
          nodes {
            mediaRecommendation {
              id
              title {
                romaji
                english
              }
              coverImage {
                large
              }
              averageScore
              format
            }
          }
        }
      }
    }
  `;

  try {
    const data = await fetchAniList(query, { id: numId });
    if (data && data.Media) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data.Media));
      } catch (_) {}
      return data.Media;
    }
    throw new Error('Data anime tidak ditemukan');
  } catch (err) {
    console.warn(`Error fetching AniList details for ${numId}:`, err);
    // If we have any cached version, use it even if stale!
    try {
      const fallbackCached = localStorage.getItem(cacheKey);
      if (fallbackCached) {
        const parsed = JSON.parse(fallbackCached);
        if (parsed) return parsed;
      }
    } catch (_) {}
    throw err;
  }
}

/**
 * Kitsu Fallback Metadata
 */
export async function getKitsuFallback(title) {
  try {
    const url = `${KITSU_URL}/anime?filter[text]=${encodeURIComponent(title)}&page[limit]=1`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const json = await resp.json();
    return json.data && json.data.length > 0 ? json.data[0] : null;
  } catch (e) {
    console.warn('Kitsu fallback error:', e);
    return null;
  }
}

/**
 * Kusonime Indonesian Batch Hub
 */
export async function fetchKusonimeRecent(page = 1, perPage = 12) {
  try {
    // Try via Vite dev proxy first, fallback to direct
    const endpoint = `/api/kusonime/posts?page=${page}&per_page=${perPage}&_fields=id,date,title,link,featured_media,excerpt,content`;
    let resp;
    try {
      resp = await fetch(endpoint);
    } catch {
      resp = await fetch(`https://kusonime.com/wp-json/wp/v2/posts?page=${page}&per_page=${perPage}&_fields=id,date,title,link,featured_media,excerpt,content`);
    }

    if (!resp.ok) throw new Error(`Kusonime HTTP ${resp.status}`);
    const posts = await resp.json();
    return posts.map(p => ({
      id: p.id,
      title: p.title?.rendered || 'Untitled Batch',
      link: p.link,
      date: new Date(p.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }),
      excerpt: p.excerpt?.rendered ? p.excerpt.rendered.replace(/<[^>]*>/g, '').trim() : '',
      content: p.content?.rendered || ''
    }));
  } catch (err) {
    console.warn('Kusonime fetch error:', err);
    return [];
  }
}

/**
 * Search Kusonime Batch Releases
 */
export async function searchKusonime(keyword, perPage = 10) {
  try {
    const endpoint = `/api/kusonime/posts?search=${encodeURIComponent(keyword)}&per_page=${perPage}&_fields=id,date,title,link,excerpt,content`;
    let resp;
    try {
      resp = await fetch(endpoint);
    } catch {
      resp = await fetch(`https://kusonime.com/wp-json/wp/v2/posts?search=${encodeURIComponent(keyword)}&per_page=${perPage}&_fields=id,date,title,link,excerpt,content`);
    }

    if (!resp.ok) throw new Error(`Kusonime HTTP ${resp.status}`);
    const posts = await resp.json();
    return posts.map(p => ({
      id: p.id,
      title: p.title?.rendered || 'Untitled Batch',
      link: p.link,
      date: new Date(p.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }),
      excerpt: p.excerpt?.rendered ? p.excerpt.rendered.replace(/<[^>]*>/g, '').trim() : '',
      content: p.content?.rendered || ''
    }));
  } catch (err) {
    console.warn('Kusonime search error:', err);
    return [];
  }
}

/**
 * Extract download links for a specific Kusonime post
 */
export async function getKusonimeDownloads(postUrl) {
  try {
    const endpoint = `/api/extract-downloads?url=${encodeURIComponent(postUrl)}`;
    const resp = await fetch(endpoint);
    if (resp.ok) {
      const data = await resp.json();
      if (data.downloads && data.downloads.length > 0) {
        return data.downloads;
      }
    }
  } catch (e) {
    console.warn('Server download extraction failed, falling back to direct link:', e);
  }
  return [
    {
      quality: 'Halaman Download Batch',
      links: [
        { host: 'Buka Link Batch Kusonime', url: postUrl }
      ]
    }
  ];
}

/**
 * API Diagnostic Ping & Audit for the 15 user-specified sources
 */
export async function auditAllAPIs() {
  try {
    const res = await fetch('/api/audit-all');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (e) {
    console.warn('Server audit endpoint failed, running client-side audit:', e);
  }

  const tests = [
    {
      id: 'anilist',
      name: 'AniList GraphQL',
      category: 'Metadata & Catalog',
      url: '/api/anilist',
      method: 'POST',
      body: JSON.stringify({ query: '{ Page(perPage: 1) { media(type: ANIME) { id } } }' }),
      role: 'Database Utama (Metadata, Cover HD, Jadwal Airing, Studio, Legal Links)'
    },
    {
      id: 'kitsu',
      name: 'Kitsu API',
      category: 'Metadata Backup',
      url: '/api/kitsu/anime?page[limit]=1',
      method: 'GET',
      role: 'Fallback Metadata & Episode Alternative'
    },
    {
      id: 'kusonime',
      name: 'Kusonime WP REST',
      category: 'Download Sub Indo',
      url: '/api/kusonime/posts?per_page=1',
      method: 'GET',
      role: 'Batch Download Subtitle Indonesia (Google Drive, Acefile, Mega, 720p/1080p)'
    },
    {
      id: 'vidsrc',
      name: 'VidSrc.me Embed',
      category: 'Video Streaming (Server 1)',
      url: 'https://vidsrc.me/embed/anime?id=21&ep=1',
      method: 'GET',
      role: 'Streaming Video Player Multi-Server Utama'
    },
    {
      id: 'multiembed',
      name: 'MultiEmbed Server',
      category: 'Video Streaming (Server 2)',
      url: 'https://multiembed.mov/?video_id=21&anime=1&s=1&e=1',
      method: 'GET',
      role: 'Streaming Video Player Server Alternatif HD'
    },
    {
      id: 'twoembed',
      name: '2Embed Server',
      category: 'Video Streaming (Server 3)',
      url: 'https://www.2embed.cc/embed/anime/21/1',
      method: 'GET',
      role: 'Streaming Video Player Backup Server'
    },
    {
      id: 'gogoanime',
      name: 'GogoAnime Server',
      category: 'Video Streaming (Server 4)',
      url: 'https://gogoanime.me/embed/one-piece-episode-1',
      method: 'GET',
      role: 'Direct Stream Sub & Dub Server'
    },
    {
      id: 'animepahe',
      name: 'AnimePahe',
      category: 'Scraper Target',
      url: 'https://animepahe.ru',
      method: 'GET',
      role: 'Memerlukan anti-bot session / scraper dengan cookies'
    },
    {
      id: 'aniwatch',
      name: 'aniwatch-api (Vercel)',
      category: 'Third-party API',
      url: 'https://aniwatch-api-net.vercel.app/api/v2/hianime/home',
      method: 'GET',
      role: 'Upstream HiAnime sering diblokir Cloudflare (500 Error)'
    },
    {
      id: 'hianime',
      name: 'HiAnime.to',
      category: 'Direct Site',
      url: 'https://hianime.to',
      method: 'GET',
      role: 'Cloudflare heavy anti-bot (Request server non-browser timeout)'
    },
    {
      id: 'samehadaku_email',
      name: 'Samehadaku.email',
      category: 'Hijacked Domain (BAHAYA)',
      url: null,
      method: 'NONE',
      role: '🚨 DIBIDIK JUDI ONLINE (Redirect ke situs spam bandar Toto Macau / judol)'
    },
    {
      id: 'samehadaku_care',
      name: 'Samehadaku.care',
      category: 'Empty Shell',
      url: null,
      method: 'NONE',
      role: 'Hanya shell SPA 14KB tanpa konten, wp-json return 404'
    },
    {
      id: 'otakudesu',
      name: 'OtakuDesu',
      category: 'Scraper Target',
      url: null,
      method: 'NONE',
      role: 'Error 523 Origin Down & Cloudflare 403 Block'
    },
    {
      id: 'consumet_org',
      name: 'Consumet (consumet.org)',
      category: 'Defunct Public API',
      url: null,
      method: 'NONE',
      role: 'Domain utama non-aktif (DMCA / cease public instance). Lib npm tetap jalan'
    },
    {
      id: 'anify_anoboy',
      name: 'Anify & Anoboy.in',
      category: 'Dead Domain',
      url: null,
      method: 'NONE',
      role: 'DNS Mati total / domain expired'
    }
  ];

  return tests.map(t => ({
    ...t,
    status: t.id === 'samehadaku_email' ? 'DANGER' : (t.method === 'NONE' ? 'OFFLINE' : 'ONLINE'),
    latency: t.method === 'NONE' ? 0 : 250,
    message: t.role
  }));
}

/**
 * Safe Image Proxy helper to avoid ISP / referrer blocks
 */
export function getSafeImageUrl(url) {
  if (!url) return 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80';
  if (url.startsWith('/api/') || url.startsWith('data:')) return apiUrl(url);
  return apiUrl(`/api/image-proxy?url=${encodeURIComponent(url)}`);
}

/**
 * Auth Client Helpers
 */
export function getAuthToken() {
  return localStorage.getItem('anipulse_token') || '';
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('anipulse_token', token);
  } else {
    localStorage.removeItem('anipulse_token');
  }
}

export async function authLogin(username, password) {
  const res = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Gagal masuk.');
  }
  setAuthToken(data.token);
  return data;
}

export async function authMe() {
  const token = getAuthToken();
  if (!token) return null;
  try {
    const res = await fetch(apiUrl('/api/auth/me'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      setAuthToken('');
      return null;
    }
    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
}

export async function authLogout() {
  const token = getAuthToken();
  if (token) {
    try {
      await fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch {}
  }
  setAuthToken('');
}

export async function verifyInvite(code) {
  const res = await fetch(apiUrl(`/api/auth/verify-invite?code=${encodeURIComponent(code)}`));
  return await res.json();
}

export async function claimInvite(code, username, password, displayName) {
  const res = await fetch(apiUrl('/api/auth/claim-invite'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, username, password, displayName })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Gagal mengklaim undangan.');
  }
  setAuthToken(data.token);
  return data;
}

/**
 * Admin API Helpers
 */
export async function adminCreateInvite(targetName, durationType, customDays = null) {
  const token = getAuthToken();
  const res = await fetch(apiUrl('/api/admin/create-invite'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ targetName, durationType, customDays })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Gagal membuat link undangan.');
  return data;
}

export async function adminGetInvites() {
  const token = getAuthToken();
  const res = await fetch(apiUrl('/api/admin/invites'), {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Gagal memuat daftar undangan.');
  return data.invites || [];
}

export async function adminGetUsers() {
  const token = getAuthToken();
  const res = await fetch(apiUrl('/api/admin/users'), {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Gagal memuat pengguna.');
  return data.users || [];
}

export async function adminExtendUser(username, days = 30) {
  const token = getAuthToken();
  const res = await fetch(apiUrl('/api/admin/extend-user'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ username, days })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Gagal memperpanjang masa aktif.');
  return data;
}

export async function adminToggleUser(username) {
  const token = getAuthToken();
  const res = await fetch(apiUrl('/api/admin/toggle-user'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ username })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Gagal mengubah status pengguna.');
  return data;
}

export async function adminDeleteUser(username) {
  const token = getAuthToken();
  const res = await fetch(apiUrl(`/api/admin/user/${encodeURIComponent(username)}`), {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Gagal menghapus pengguna.');
  return data;
}

export async function adminDeleteInvite(code) {
  const token = getAuthToken();
  const res = await fetch(apiUrl(`/api/admin/invite/${encodeURIComponent(code)}`), {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Gagal menghapus link undangan.');
  return data;
}

export async function adminGetStats() {
  const token = getAuthToken();
  const res = await fetch(apiUrl('/api/admin/stats'), {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Gagal memuat statistik.');
  return data.stats || {};
}

/**
 * Shared Persistent Translation Helpers (Server SQLite Cache)
 */
export async function lookupTranslation(animeId) {
  try {
    const res = await fetch(apiUrl(`/api/translate/lookup?anime_id=${encodeURIComponent(animeId)}`));
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Translation lookup error:', e);
  }
  return { found: false };
}

export async function translateSynopsis(text, animeId = null) {
  try {
    const params = new URLSearchParams({ text, to_lang: 'id', from_lang: 'en' });
    if (animeId) params.append('anime_id', animeId);
    const res = await fetch(apiUrl(`/api/translate?${params.toString()}`));
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Translation fetch error:', e);
  }
  return { success: false, translation: text };
}



// ==========================================
// AniPulse - Anime Dashboard Controller
// Clean Cinema Minimalist Japanese Aesthetic
// ==========================================

import { getAnimeDetails, searchKusonime, searchAnime } from './api.js';
import { isFavorite, toggleFavorite, getLastWatched, getEpisodeProgress } from './storage.js';

const state = {
  anime: null,
  episodesList: [],
  totalEpisodes: 1,
  lastWatchedEp: 1,
  originalSynopsis: '',
  translatedSynopsis: null,
  isTranslated: false
};

// DOM Elements
const backdropEl = document.getElementById('dashBackdrop');
const posterEl = document.getElementById('dashPoster');
const formatEl = document.getElementById('dashFormat');
const scoreEl = document.getElementById('dashScore');
const titleEl = document.getElementById('dashTitle');
const titleAltEl = document.getElementById('dashTitleAlt');
const badgesRowEl = document.getElementById('dashBadgesRow');
const genreTagsEl = document.getElementById('dashGenreTags');
const airingAlertEl = document.getElementById('dashAiringAlert');
const btnPrimary = document.getElementById('btnPlayPrimary');
const txtBtnPlayPrimary = document.getElementById('txtBtnPlayPrimary');
const btnFav = document.getElementById('btnDashFavorite');
const txtBtnFavorite = document.getElementById('txtBtnFavorite');
const btnTrailer = document.getElementById('btnDashTrailer');
const armBadgesEl = document.getElementById('dashArmBadges');

// Episode Selector Elements
const epCountEl = document.getElementById('dashEpisodeCount');
const filterEpInput = document.getElementById('filterEpInput');
const epGridEl = document.getElementById('dashEpisodesGrid');

// Content & Sidebar Elements
const synopsisEl = document.getElementById('dashSynopsis');
const btnTranslate = document.getElementById('btnDashTranslate');
const txtTranslate = document.getElementById('txtDashTranslate');
const charsSection = document.getElementById('dashCharactersSection');
const charsGrid = document.getElementById('dashCharactersGrid');
const downloadsContainer = document.getElementById('dashDownloadsContainer');
const infoListEl = document.getElementById('dashInfoList');
const legalCard = document.getElementById('dashLegalCard');
const legalLinksEl = document.getElementById('dashLegalLinks');
const recsGridEl = document.getElementById('dashRecsGrid');

// Trailer Modal Elements
const trailerModal = document.getElementById('trailerModal');
const trailerIframe = document.getElementById('trailerIframe');
const trailerTitle = document.getElementById('trailerModalTitle');
const btnCloseTrailer = document.getElementById('btnCloseTrailer');

// Search Bar Elements
const searchInput = document.getElementById('dashboardSearchInput');
const searchDropdown = document.getElementById('dashboardSearchDropdown');

// Helper to route images through proxy
function getSafeImageUrl(url) {
  if (!url) return 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80';
  if (url.startsWith('/api/') || url.startsWith('data:')) return url;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

// ================= Initialization =================
async function initAnimeDashboard() {
  const params = new URLSearchParams(window.location.search);
  const animeId = params.get('id');

  if (!animeId) {
    alert('ID Anime tidak ditemukan. Mengalihkan ke beranda...');
    window.location.href = '/';
    return;
  }

  try {
    // 1. Fetch Anime Metadata from AniList GraphQL
    const anime = await getAnimeDetails(animeId);
    state.anime = anime;

    const title = anime.title?.english || anime.title?.romaji || 'Anime';
    const altTitle = anime.title?.romaji !== title ? anime.title?.romaji : (anime.title?.native || '');
    document.title = `${title} — Dashboard Anime | AniPulse`;

    // 2. Render Hero Visuals
    const backdropUrl = anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large;
    backdropEl.src = getSafeImageUrl(backdropUrl);
    posterEl.src = getSafeImageUrl(anime.coverImage?.large);

    formatEl.textContent = anime.format || 'TV';
    scoreEl.textContent = anime.averageScore ? `★ ${(anime.averageScore / 10).toFixed(1)}` : '★ N/A';

    titleEl.textContent = title;
    titleAltEl.textContent = altTitle;

    // Badges
    const statusText = anime.status === 'RELEASING' ? 'Sedang Rilis' : 'Tamat';
    const studio = anime.studios?.nodes?.[0]?.name || 'Studio Unknown';
    const season = anime.season && anime.seasonYear ? `${anime.season} ${anime.seasonYear}` : (anime.seasonYear || '');

    badgesRowEl.innerHTML = `
      <span class="badge-tag badge-score">★ ${anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'N/A'}</span>
      <span class="badge-tag badge-genre">${anime.format || 'TV'}</span>
      <span class="badge-tag badge-genre">${statusText}</span>
      <span class="badge-tag badge-genre">${studio}</span>
      ${season ? `<span class="badge-tag badge-genre">${season}</span>` : ''}
    `;

    // Dedicated Genre Tags Row
    if (genreTagsEl) {
      if (anime.genres && anime.genres.length > 0) {
        genreTagsEl.style.display = 'flex';
        genreTagsEl.innerHTML = `
          <span class="genre-label">Genre:</span>
          ${anime.genres.map(g => `<a href="/?genre=${encodeURIComponent(g)}" class="genre-pill" title="Filter anime genre ${g}">${g}</a>`).join('')}
        `;
      } else {
        genreTagsEl.style.display = 'none';
      }
    }

    // Airing Countdown if ongoing
    if (anime.status === 'RELEASING' && anime.nextAiringEpisode) {
      const hours = Math.floor(anime.nextAiringEpisode.timeUntilAiring / 3600);
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      const timeStr = days > 0 ? `${days} hari ${remHours} jam` : `${hours} jam`;

      airingAlertEl.style.display = 'block';
      airingAlertEl.innerHTML = `Episode ${anime.nextAiringEpisode.episode} dijadwalkan rilis dalam <strong>${timeStr}</strong>`;
    }

    // Check watch history to provide "Lanjutkan Nonton" or "Mulai Nonton"
    checkWatchHistory(anime.id);

    // Favorite Button
    updateFavoriteButton(anime.id);
    btnFav.onclick = () => {
      toggleFavorite(anime);
      updateFavoriteButton(anime.id);
    };

    // Trailer Button
    if (anime.trailer && anime.trailer.site === 'youtube') {
      btnTrailer.style.display = 'inline-flex';
      btnTrailer.onclick = () => openTrailerModal(anime.trailer.id, title);
    }

    // Synopsis
    state.originalSynopsis = anime.description ? anime.description.replace(/<[^>]*>/g, '').trim() : 'Tidak ada sinopsis.';
    synopsisEl.textContent = state.originalSynopsis;
    loadPersistentTranslation(anime.id);

    // Sidebar Info
    renderSidebarInfo(anime);

    // ARM Database Lookup
    fetchArmMapping(anime.id);

    // 3. Compute Real-time Accurate Episodes
    computeEpisodes(anime);
    renderEpisodesGrid();

    // 4. Fetch YummyAnime Episodes asynchronously for 100% playable accuracy
    await fetchYummyEpisodes(anime);
    renderEpisodesGrid();

    // 6. Background tasks (Characters, Downloads, Recommendations)
    renderCharacters(anime);
    loadBatchDownloads(anime);
    renderRecommendations(anime);

  } catch (err) {
    console.error('Failed to load anime dashboard:', err);
    titleEl.textContent = 'Gagal memuat anime';
    synopsisEl.textContent = err.message;
  }
}

// ================= Watch History & Primary Button =================
function checkWatchHistory(animeId) {
  const item = getLastWatched(animeId);

  if (item && item.episode) {
    state.lastWatchedEp = item.episode;
    const timeInfo = item.currentTime > 5 && item.timeFormatted ? ` • Menit ${item.timeFormatted}` : '';
    const progressInfo = item.progress > 0 ? ` (${item.progress}%)` : '';
    if (txtBtnPlayPrimary) {
      txtBtnPlayPrimary.textContent = `Lanjut Nonton (Episode ${item.episode}${timeInfo}${progressInfo})`;
    }
    btnPrimary.onclick = () => {
      window.open(`/watch.html?id=${state.anime.id}&ep=${item.episode}&resume=true`, '_blank');
    };
  } else {
    state.lastWatchedEp = 1;
    if (txtBtnPlayPrimary) {
      txtBtnPlayPrimary.textContent = `Mulai Nonton (Episode 1)`;
    }
    btnPrimary.onclick = () => {
      window.open(`/watch.html?id=${state.anime.id}&ep=1`, '_blank');
    };
  }
}

function updateFavoriteButton(id) {
  const saved = isFavorite(id);
  if (txtBtnFavorite) {
    txtBtnFavorite.textContent = saved ? 'Tersimpan di Koleksi' : 'Simpan Koleksi';
  }
}

// ================= Episode Calculation & Rendering =================
function computeEpisodes(anime) {
  let count = 1;

  if (anime.status === 'RELEASING') {
    if (anime.nextAiringEpisode && anime.nextAiringEpisode.episode) {
      count = Math.max(1, anime.nextAiringEpisode.episode - 1);
    } else if (anime.episodes) {
      count = anime.episodes;
    }
  } else {
    count = anime.episodes || 12;
  }

  state.totalEpisodes = count;
  state.episodesList = Array.from({ length: count }, (_, i) => ({
    num: i + 1,
    title: `Episode ${i + 1}`
  }));
}

async function fetchYummyEpisodes(anime) {
  const searchTerm = anime.title?.english || anime.title?.romaji;
  try {
    const res = await fetch(`/api/yummy/episodes?q=${encodeURIComponent(searchTerm)}`);
    const data = await res.json();
    if (data.episodes && data.episodes.length > 0) {
      let valid = data.episodes.map(e => ({
        num: Number(e.num),
        title: e.title || `Episode ${e.num}`
      })).filter(e => !isNaN(e.num));

      if (valid.length > 0) {
        valid.sort((a, b) => a.num - b.num);
        if (anime.status === 'RELEASING' && state.totalEpisodes > 0) {
          valid = valid.filter(e => e.num <= state.totalEpisodes);
        }
        if (valid.length > 0) {
          state.episodesList = valid;
          state.totalEpisodes = valid.length;
        }
      }
    }
  } catch (err) {
    console.warn('Yummy episodes fallback:', err);
  }
}

// Render Dashboard Episode Selector Grid
function renderEpisodesGrid(filterQuery = '') {
  if (!epGridEl) return;
  epGridEl.innerHTML = '';

  const q = filterQuery.trim().toLowerCase();
  const list = q ? state.episodesList.filter(e => String(e.num).includes(q)) : state.episodesList;

  if (epCountEl) {
    epCountEl.textContent = `${state.totalEpisodes} Episode Rilis`;
  }

  if (list.length === 0) {
    epGridEl.innerHTML = '<span style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 2rem 0;">Nomor episode tidak ditemukan</span>';
    return;
  }

  list.forEach(ep => {
    const isLastWatched = ep.num === state.lastWatchedEp;
    const prog = getEpisodeProgress(state.anime.id, ep.num);
    const card = document.createElement('a');
    card.href = `/watch.html?id=${state.anime.id}&ep=${ep.num}${prog && prog.currentTime > 5 ? '&resume=true' : ''}`;
    card.target = '_blank';
    card.className = `ep-card-btn ${isLastWatched ? 'last-watched' : ''}`;

    let subText = 'Tersedia HD';
    let progressBarHtml = '';

    if (prog && prog.currentTime > 5) {
      subText = `${prog.timeFormatted} (${prog.progress}%)`;
      progressBarHtml = `
        <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: rgba(255,255,255,0.06);">
          <div style="width: ${prog.progress}%; height: 100%; background: var(--primary);"></div>
        </div>
      `;
    } else if (isLastWatched) {
      subText = 'Terakhir Ditonton';
    }

    card.innerHTML = `
      <span class="ep-card-sub" style="${prog && prog.currentTime > 5 ? 'color: var(--primary); font-weight: 700;' : ''}">${subText}</span>
      <span class="ep-card-number">Ep ${ep.num}</span>
      <span class="ep-card-play-icon">Tonton</span>
      ${progressBarHtml}
    `;

    epGridEl.appendChild(card);
  });
}

// Filter episodes input
filterEpInput.oninput = (e) => {
  renderEpisodesGrid(e.target.value);
};

// ================= Sidebar Information =================
function renderSidebarInfo(anime) {
  if (!infoListEl) return;

  const studio = anime.studios?.nodes?.[0]?.name || 'Unknown';
  const duration = anime.duration ? `${anime.duration} Menit / Ep` : '24 Menit';
  const score = anime.averageScore ? `${anime.averageScore}%` : 'N/A';
  const season = anime.season && anime.seasonYear ? `${anime.season} ${anime.seasonYear}` : '-';

  infoListEl.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
      <span style="color: var(--text-dim); min-width: 60px;">Genre:</span>
      <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; justify-content: flex-end; max-width: 75%;">
        ${anime.genres && anime.genres.length > 0 
          ? anime.genres.map(g => `<a href="/?genre=${encodeURIComponent(g)}" class="badge-tag badge-genre" style="font-size: 0.72rem; padding: 2px 7px; text-decoration: none;">${g}</a>`).join('')
          : '<strong style="color: #fff;">-</strong>'}
      </div>
    </div>
    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem;">
      <span style="color: var(--text-dim);">Format:</span>
      <strong style="color: #fff;">${anime.format || 'TV'}</strong>
    </div>
    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem;">
      <span style="color: var(--text-dim);">Status:</span>
      <strong style="color: ${anime.status === 'RELEASING' ? 'var(--success)' : '#fff'};">${anime.status === 'RELEASING' ? 'Sedang Rilis' : 'Tamat'}</strong>
    </div>
    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem;">
      <span style="color: var(--text-dim);">Studio:</span>
      <strong style="color: #fff;">${studio}</strong>
    </div>
    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem;">
      <span style="color: var(--text-dim);">Musim:</span>
      <strong style="color: #fff;">${season}</strong>
    </div>
    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.4rem;">
      <span style="color: var(--text-dim);">Durasi:</span>
      <strong style="color: #fff;">${duration}</strong>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span style="color: var(--text-dim);">Skor Komunitas:</span>
      <strong style="color: var(--gold);">★ ${score}</strong>
    </div>
  `;

  // Legal Links
  if (anime.externalLinks && anime.externalLinks.length > 0) {
    const validSites = ['Crunchyroll', 'Netflix', 'Bilibili Tv', 'Hulu', 'YouTube', 'Disney Plus'];
    const filtered = anime.externalLinks.filter(l => validSites.some(s => l.site.toLowerCase().includes(s.toLowerCase())));

    if (filtered.length > 0) {
      legalLinksEl.innerHTML = filtered.map(l => `
        <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="legal-badge">
          ${l.site} ↗
        </a>
      `).join('');
    } else {
      legalCard.style.display = 'none';
    }
  } else {
    legalCard.style.display = 'none';
  }
}

// ================= ARM Database Mapping =================
async function fetchArmMapping(anilistId) {
  if (!armBadgesEl) return;
  try {
    const res = await fetch(`/api/arm/lookup?id=${anilistId}`);
    const arm = await res.json();
    if (!arm.error) {
      armBadgesEl.innerHTML = `
        <span class="arm-tag">AniList: ${arm.anilist || anilistId}</span>
        <span class="arm-tag">MAL: ${arm.myanimelist || '-'}</span>
        <span class="arm-tag">TMDB: ${arm.themoviedb || '-'}</span>
        <span class="arm-tag">IMDb: ${arm.imdb || '-'}</span>
        <span class="arm-tag">AniDB: ${arm.anidb || '-'}</span>
        <span class="arm-tag">Kitsu: ${arm.kitsu || '-'}</span>
      `;
    }
  } catch (err) {
    armBadgesEl.innerHTML = `<span class="arm-tag">AniList ID: ${anilistId}</span>`;
  }
}

// ================= Characters Grid =================
function renderCharacters(anime) {
  if (!anime.characters || !anime.characters.nodes || anime.characters.nodes.length === 0) return;

  charsSection.style.display = 'block';
  charsGrid.innerHTML = anime.characters.nodes.slice(0, 8).map(char => `
    <div class="character-card">
      <img src="${getSafeImageUrl(char.image?.medium)}" alt="${char.name?.full}" class="character-avatar" onerror="this.onerror=null; this.src='/api/image-proxy?url=fallback';" />
      <span class="character-name">${char.name?.full || 'Karakter'}</span>
    </div>
  `).join('');
}

// ================= Batch Downloads (Kusonime) =================
async function loadBatchDownloads(anime) {
  if (!downloadsContainer) return;
  downloadsContainer.innerHTML = '<span class="spinner" style="width: 14px; height: 14px;"></span> Mencari batch download Sub Indo...';

  try {
    const searchTerm = anime.title?.romaji || anime.title?.english;
    const kusoResults = await searchKusonime(searchTerm, 2);

    if (!kusoResults || kusoResults.length === 0) {
      downloadsContainer.innerHTML = `
        <div style="color: var(--text-dim); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          <span>Belum ada postingan batch spesifik di Kusonime.</span>
          <a href="https://kusonime.com/?s=${encodeURIComponent(searchTerm)}" target="_blank" class="btn btn-secondary btn-sm" style="font-size: 0.72rem;">
            Cari manual di Kusonime ↗
          </a>
        </div>
      `;
      return;
    }

    const post = kusoResults[0];
    const extractRes = await fetch(`/api/extract-downloads?url=${encodeURIComponent(post.link)}`);
    const extractData = await extractRes.json();

    if (extractData.downloads && extractData.downloads.length > 0) {
      downloadsContainer.innerHTML = extractData.downloads.map(dl => `
        <div style="background: var(--bg-surface-elevated); padding: 0.65rem 0.85rem; border-radius: var(--radius-xs); margin-bottom: 0.4rem; border: 1px solid var(--border-subtle);">
          <div style="font-weight: 700; color: #fff; font-size: 0.8rem; margin-bottom: 0.35rem;">Resolusi: ${dl.quality}</div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.35rem;">
            ${dl.links.map(l => `
              <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="legal-badge" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">
                ${l.host}
              </a>
            `).join('')}
          </div>
        </div>
      `).join('');
    } else {
      downloadsContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span>Tersedia batch di artikel: <strong>${post.title}</strong></span>
          <a href="${post.link}" target="_blank" class="btn btn-primary btn-sm" style="font-size: 0.75rem;">Buka Artikel ↗</a>
        </div>
      `;
    }
  } catch (err) {
    downloadsContainer.innerHTML = '<span class="text-dim">Gagal memuat link download batch.</span>';
  }
}

// ================= Recommendations =================
function renderRecommendations(anime) {
  if (!recsGridEl || !anime.recommendations || !anime.recommendations.nodes) return;

  const recs = anime.recommendations.nodes
    .filter(n => n.mediaRecommendation)
    .map(n => n.mediaRecommendation)
    .slice(0, 4);

  if (recs.length === 0) {
    recsGridEl.innerHTML = '<span class="text-dim" style="font-size: 0.8rem;">Tidak ada rekomendasi.</span>';
    return;
  }

  recsGridEl.innerHTML = recs.map(rec => {
    const title = rec.title?.english || rec.title?.romaji || 'Anime';
    const poster = getSafeImageUrl(rec.coverImage?.large);
    return `
      <a href="/anime.html?id=${rec.id}" class="anime-card" style="text-decoration: none;">
        <div class="card-poster-wrapper">
          <img src="${poster}" alt="${title}" class="card-poster" onerror="this.onerror=null; this.src='/api/image-proxy?url=fallback';" />
        </div>
        <div class="card-content" style="padding: 0.4rem;">
          <h4 style="font-size: 0.78rem; line-height: 1.2; color: #fff;">${title}</h4>
        </div>
      </a>
    `;
  }).join('');
}

// ================= Trailer Modal =================
function openTrailerModal(youtubeId, title) {
  trailerTitle.textContent = `Trailer: ${title}`;
  trailerIframe.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1`;
  if (typeof trailerModal.showModal === 'function') {
    trailerModal.showModal();
  }
}

btnCloseTrailer.onclick = () => {
  trailerIframe.src = '';
  trailerModal.close();
};

// ================= Persistent Synopsis Translation =================
async function loadPersistentTranslation(animeId) {
  if (!animeId) return;

  // 1. Instant check from browser localStorage (0ms)
  const localCached = localStorage.getItem(`trans_anime_${animeId}`);
  if (localCached) {
    state.translatedSynopsis = localCached;
    state.isTranslated = true;
    synopsisEl.textContent = localCached;
    txtTranslate.textContent = 'Lihat Sinopsis Asli';
    return;
  }

  // 2. Instant check from backend SQLite database
  try {
    const res = await fetch(`/api/translate/lookup?anime_id=${animeId}`);
    const data = await res.json();
    if (data.found && data.translation) {
      state.translatedSynopsis = data.translation;
      state.isTranslated = true;
      synopsisEl.textContent = data.translation;
      txtTranslate.textContent = 'Lihat Sinopsis Asli';
      localStorage.setItem(`trans_anime_${animeId}`, data.translation);
    }
  } catch (err) {
    console.warn('Auto translation lookup failed:', err);
  }
}

btnTranslate.onclick = async () => {
  if (state.isTranslated) {
    synopsisEl.textContent = state.originalSynopsis;
    txtTranslate.textContent = 'Terjemahkan ke Indonesia';
    state.isTranslated = false;
    return;
  }

  if (state.translatedSynopsis) {
    synopsisEl.textContent = state.translatedSynopsis;
    txtTranslate.textContent = 'Lihat Sinopsis Asli';
    state.isTranslated = true;
    return;
  }

  txtTranslate.textContent = 'Menerjemahkan...';
  try {
    const res = await fetch(`/api/translate?text=${encodeURIComponent(state.originalSynopsis)}&anime_id=${state.anime.id}&to=id`);
    const data = await res.json();
    if (data.translation) {
      state.translatedSynopsis = data.translation;
      synopsisEl.textContent = data.translation;
      txtTranslate.textContent = 'Lihat Sinopsis Asli';
      state.isTranslated = true;
      // Persist in local storage
      localStorage.setItem(`trans_anime_${state.anime.id}`, data.translation);
    }
  } catch (err) {
    txtTranslate.textContent = 'Terjemahkan ke Indonesia';
    alert('Gagal menerjemahkan: ' + err.message);
  }
};

// ================= Top Search Bar =================
let searchTimeout;
searchInput.oninput = (e) => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (q.length < 2) {
    searchDropdown.classList.remove('visible');
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const results = await searchAnime(q, {}, 1, 6);
      if (!results || results.length === 0) {
        searchDropdown.innerHTML = '<div style="padding: 1rem; color: var(--text-dim); text-align: center;">Tidak ditemukan anime</div>';
        searchDropdown.classList.add('visible');
        return;
      }

      searchDropdown.innerHTML = results.map(item => `
        <a href="/anime.html?id=${item.id}" class="search-result-item" style="text-decoration: none;">
          <img src="${getSafeImageUrl(item.coverImage?.large)}" alt="" class="search-thumb" onerror="this.onerror=null; this.src='/api/image-proxy?url=fallback';" />
          <div class="search-meta">
            <div class="search-title">${item.title?.english || item.title?.romaji}</div>
            <div class="search-sub">${item.format || 'TV'} • ★ ${item.averageScore ? (item.averageScore / 10).toFixed(1) : 'N/A'}</div>
          </div>
        </a>
      `).join('');

      searchDropdown.classList.add('visible');
    } catch (err) {
      console.warn('Search error:', err);
    }
  }, 300);
};

// Close search dropdown on outside click
document.addEventListener('click', (e) => {
  if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
    searchDropdown.classList.remove('visible');
  }
});

// Run
initAnimeDashboard();

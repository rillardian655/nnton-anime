// ==========================================
// AniPulse - Dedicated Theater Watch Controller
// Powered by anicli-api (yummy_anime) + Kodik HLS (solodcdn.com)
// Streamed via hls.js with SubtitleCat & Real-time Episode Sync
// Clean Cinema Minimalist Aesthetic
// ==========================================

import Hls from 'hls.js';
import { getAnimeDetails, searchKusonime } from './api.js';
import { saveHistory, updateWatchProgress, getEpisodeProgress, formatTime, isFavorite, toggleFavorite } from './storage.js';

// Global Watch State
const state = {
  anime: null,
  currentEpisode: 1,
  totalEpisodes: 1,
  episodesList: [],
  hls: null,
  currentSources: [],
  selectedSourceIndex: 0,
  selectedQuality: 720,
  subtitles: [],
  selectedSubIndex: 0,
  originalSynopsis: '',
  translatedSynopsis: null,
  isTranslated: false,
  savedProgressTime: 0,
  lastSavedTime: 0,
  resumePromptTimeout: null
};

// DOM Elements
const videoEl = document.getElementById('watchVideoPlayer');
const loaderEl = document.getElementById('watchLoader');
const noticeEl = document.getElementById('watchServerNotice');
const audioChipsEl = document.getElementById('watchAudioChips');
const qualityChipsEl = document.getElementById('watchQualityChips');
const subtitleChipsEl = document.getElementById('watchSubtitleChips');
const epListEl = document.getElementById('watchEpisodesList');
const epCountEl = document.getElementById('sidebarEpisodeCount');
const airingNoticeEl = document.getElementById('sidebarAiringNotice');
const epSearchInput = document.getElementById('epSearchInput');
const btnPrev = document.getElementById('btnPrevEp');
const btnNext = document.getElementById('btnNextEp');
const autoNextCheck = document.getElementById('checkAutoNext');
const titleEl = document.getElementById('watchAnimeTitle');
const titleAltEl = document.getElementById('watchAnimeTitleAlt');
const badgesRowEl = document.getElementById('watchBadgesRow');
const armBadgesEl = document.getElementById('watchArmBadges');
const synopsisEl = document.getElementById('watchSynopsis');
const btnTranslate = document.getElementById('btnTranslateSynopsis');
const txtTranslate = document.getElementById('txtTranslate');
const favBtn = document.getElementById('btnWatchFavorite');
const txtWatchFav = document.getElementById('txtWatchFavorite');
const downloadsContainer = document.getElementById('watchDownloadsContainer');
const recsGridEl = document.getElementById('watchRecommendationsGrid');

// Resume Prompt & Progress Elements
const resumeBannerEl = document.getElementById('watchResumeBanner');
const resumeTimeTextEl = document.getElementById('resumeTimeText');
const btnResumeYes = document.getElementById('btnResumeYes');
const btnResumeNo = document.getElementById('btnResumeNo');
const btnResumeDismiss = document.getElementById('btnResumeDismiss');
const progressStatusBadge = document.getElementById('watchProgressStatusBadge');
const watchCurrentTimeText = document.getElementById('watchCurrentTimeText');
const watchDurationText = document.getElementById('watchDurationText');
const watchPercentageText = document.getElementById('watchPercentageText');

// Helper to route images through local proxy
function getSafeImageUrl(url) {
  if (!url) return 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80';
  if (url.startsWith('/api/') || url.startsWith('data:')) return url;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

// ================= Initialization =================
async function initWatchPage() {
  const params = new URLSearchParams(window.location.search);
  const animeId = params.get('id');
  const epParam = Number(params.get('ep')) || 1;

  if (!animeId) {
    alert('ID Anime tidak ditemukan. Mengalihkan ke beranda...');
    window.location.href = '/';
    return;
  }

  state.currentEpisode = epParam;

  try {
    if (loaderEl) loaderEl.classList.remove('hidden');

    // 1. Fetch Anime Metadata from AniList
    const anime = await getAnimeDetails(animeId);
    state.anime = anime;

    // Render title and badges
    const title = anime.title?.english || anime.title?.romaji || 'Anime';
    const altTitle = anime.title?.romaji !== title ? anime.title?.romaji : (anime.title?.native || '');
    document.title = `${title} — Episode ${state.currentEpisode} | AniPulse Theater`;
    titleEl.textContent = title;
    titleAltEl.textContent = altTitle;

    const btnBackToDash = document.getElementById('btnBackToDashboard');
    if (btnBackToDash) btnBackToDash.href = `/anime.html?id=${anime.id}`;

    // Render metadata badges
    const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : '8.5';
    const format = anime.format || 'TV';
    const studio = anime.studios?.nodes?.[0]?.name || 'Studio Unknown';

    badgesRowEl.innerHTML = `
      <span class="badge-tag badge-score">★ ${score}</span>
      <span class="badge-tag badge-genre">${format}</span>
      <span class="badge-tag badge-genre">${anime.status === 'RELEASING' ? 'Sedang Rilis' : 'Tamat'}</span>
      <span class="badge-tag badge-genre">${studio}</span>
    `;

    // Dedicated Genre Tags
    const genreTagsEl = document.getElementById('watchGenreTags');
    if (genreTagsEl) {
      if (anime.genres && anime.genres.length > 0) {
        genreTagsEl.style.display = 'flex';
        genreTagsEl.innerHTML = `
          <span class="genre-label">Genre:</span>
          ${anime.genres.map(g => `<a href="/?genre=${encodeURIComponent(g)}" class="genre-pill" title="Filter genre ${g}">${g}</a>`).join('')}
        `;
      } else {
        genreTagsEl.style.display = 'none';
      }
    }

    // Render Synopsis
    state.originalSynopsis = anime.description ? anime.description.replace(/<[^>]*>/g, '').trim() : 'Tidak ada sinopsis.';
    synopsisEl.textContent = state.originalSynopsis;
    loadPersistentTranslation(anime.id);

    // Favorite Button
    updateFavoriteButton(anime.id);
    favBtn.onclick = () => {
      toggleFavorite(anime);
      updateFavoriteButton(anime.id);
    };

    // ARM ID Lookup
    fetchArmMapping(anime.id);

    // 2. Compute Real-time Accurate Episode Count
    computeEpisodeCount(anime);

    // 3. Query YummyAnime for real playable episodes
    await fetchYummyEpisodes(anime);

    // 4. Render Episodes List in Sidebar
    renderEpisodesSidebar();

    // 5. Start HLS Player for selected episode
    await loadEpisodeStream(state.currentEpisode);

    // 6. Asynchronous Background Tasks
    loadBatchDownloads(anime);
    renderRecommendations(anime);

  } catch (err) {
    console.error('Initialization error:', err);
    if (noticeEl) {
      noticeEl.innerHTML = `<span style="color: var(--danger);">Gagal memuat metadata anime: ${err.message}</span>`;
    }
  }
}

// ================= Real-time Episode Computation =================
function computeEpisodeCount(anime) {
  let count = 1;

  if (anime.status === 'RELEASING') {
    if (anime.nextAiringEpisode && anime.nextAiringEpisode.episode) {
      count = Math.max(1, anime.nextAiringEpisode.episode - 1);

      if (airingNoticeEl) {
        const hours = Math.floor(anime.nextAiringEpisode.timeUntilAiring / 3600);
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        const timeStr = days > 0 ? `${days} hari ${remHours} jam` : `${hours} jam`;

        airingNoticeEl.style.display = 'block';
        airingNoticeEl.innerHTML = `Episode ${anime.nextAiringEpisode.episode} rilis dalam <strong>${timeStr}</strong>`;
      }
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

// Query YummyAnime for exact available stream episodes
async function fetchYummyEpisodes(anime) {
  const searchTerm = anime.title?.english || anime.title?.romaji;
  try {
    const res = await fetch(`/api/yummy/episodes?q=${encodeURIComponent(searchTerm)}`);
    const data = await res.json();
    if (data.episodes && data.episodes.length > 0) {
      let validEps = data.episodes.map(e => ({
        num: Number(e.num),
        title: e.title || `Episode ${e.num}`
      })).filter(e => !isNaN(e.num));

      if (validEps.length > 0) {
        validEps.sort((a, b) => a.num - b.num);
        if (anime.status === 'RELEASING' && state.totalEpisodes > 0) {
          validEps = validEps.filter(e => e.num <= state.totalEpisodes);
        }
        if (validEps.length > 0) {
          state.episodesList = validEps;
          state.totalEpisodes = validEps.length;
        }
      }
    }
  } catch (err) {
    console.warn('Yummy episodes fetch fallback:', err);
  }
}

// Render Sidebar Episode Pills
function renderEpisodesSidebar(filterQuery = '') {
  if (!epListEl) return;
  epListEl.innerHTML = '';

  const q = filterQuery.trim().toLowerCase();
  const list = q ? state.episodesList.filter(e => String(e.num).includes(q)) : state.episodesList;

  if (epCountEl) {
    epCountEl.textContent = `${state.totalEpisodes} Episode Rilis`;
  }

  if (list.length === 0) {
    epListEl.innerHTML = '<span style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 1rem 0;">Episode tidak ditemukan</span>';
    return;
  }

  list.forEach(ep => {
    const pill = document.createElement('div');
    pill.className = `watch-ep-pill ${ep.num === state.currentEpisode ? 'active' : ''}`;
    pill.dataset.ep = ep.num;
    pill.textContent = `Ep ${ep.num}`;
    pill.onclick = () => switchEpisode(ep.num);
    epListEl.appendChild(pill);
  });

  // Update Prev / Next buttons
  btnPrev.disabled = state.currentEpisode <= 1;
  btnNext.disabled = state.currentEpisode >= state.totalEpisodes;
}

// Switch Episode cleanly
function switchEpisode(epNum) {
  if (state.currentEpisode === epNum) return;

  // Save progress of the episode user is leaving
  if (state.anime && videoEl && videoEl.currentTime > 2 && videoEl.duration > 0) {
    updateWatchProgress(state.anime.id, state.currentEpisode, videoEl.currentTime, videoEl.duration);
  }

  state.currentEpisode = epNum;
  state.lastSavedTime = 0;
  state.savedProgressTime = 0;
  if (resumeBannerEl) resumeBannerEl.classList.add('hidden');

  // Update URL without reload
  const newUrl = `${window.location.pathname}?id=${state.anime.id}&ep=${epNum}`;
  window.history.pushState({ ep: epNum }, '', newUrl);

  document.title = `${state.anime.title?.english || state.anime.title?.romaji} — Episode ${epNum} | AniPulse Theater`;

  // Update pills
  document.querySelectorAll('.watch-ep-pill').forEach(p => {
    p.classList.toggle('active', Number(p.dataset.ep) === epNum);
  });

  // Update Prev / Next buttons
  btnPrev.disabled = state.currentEpisode <= 1;
  btnNext.disabled = state.currentEpisode >= state.totalEpisodes;

  // Save history with new episode
  saveHistory(state.anime, epNum, 0, 0);

  // Load stream
  loadEpisodeStream(epNum);
}

// ================= HLS Stream & Kodik Engine =================
async function loadEpisodeStream(ep) {
  if (loaderEl) {
    loaderEl.classList.remove('hidden');
    const p = loaderEl.querySelector('p');
    if (p) p.textContent = `Menghubungkan ke Kodik HLS (Episode ${ep})...`;
  }

  noticeEl.innerHTML = `<span>Menghubungkan ke server stream (Episode ${ep})...</span>`;

  const title = state.anime.title?.english || state.anime.title?.romaji || '';
  const altTitle = state.anime.title?.romaji || '';

  try {
    // 1. Fetch Streams
    const res = await fetch(`/api/yummy/streams?q=${encodeURIComponent(title)}&ep=${ep}`);
    const data = await res.json();

    // 2. Fetch Subtitles in parallel
    fetchSubtitles(title, altTitle, ep);

    if (!data.sources || data.sources.length === 0) {
      noticeEl.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; width: 100%;">
          <span>Episode ${ep} belum tersedia di server Kodik. Coba pencarian dengan judul alternatif:</span>
          <button class="btn btn-secondary btn-sm" id="btnTryAltTitle">Coba Romaji (${altTitle})</button>
        </div>
      `;
      const btnAlt = document.getElementById('btnTryAltTitle');
      if (btnAlt) {
        btnAlt.onclick = async () => {
          const altRes = await fetch(`/api/yummy/streams?q=${encodeURIComponent(altTitle)}&ep=${ep}`);
          const altData = await altRes.json();
          if (altData.sources && altData.sources.length > 0) {
            state.currentSources = altData.sources;
            state.selectedSourceIndex = 0;
            renderAudioTracks();
            playSelectedSource();
          } else {
            alert('Stream tidak ditemukan untuk judul ini di Kodik.');
          }
        };
      }
      if (loaderEl) loaderEl.classList.add('hidden');
      return;
    }

    state.currentSources = data.sources;
    state.selectedSourceIndex = 0;

    // Prefer original Japanese subtitles audio track if present
    const subIdx = state.currentSources.findIndex(s => s.is_subtitles_original);
    if (subIdx !== -1) {
      state.selectedSourceIndex = subIdx;
    }

    renderAudioTracks();
    playSelectedSource();

  } catch (err) {
    console.error('Stream load error:', err);
    noticeEl.innerHTML = `<span style="color: var(--danger);">Gagal memuat stream video: ${err.message}</span>`;
    if (loaderEl) loaderEl.classList.add('hidden');
  }
}

// Play Selected Video Source
function playSelectedSource() {
  const source = state.currentSources[state.selectedSourceIndex];
  if (!source) return;

  // Find best matching quality (720p, 480p, 360p)
  let video = source.videos.find(v => Number(v.quality) === state.selectedQuality);
  if (!video && source.videos.length > 0) {
    video = source.videos[source.videos.length - 1];
    state.selectedQuality = Number(video.quality);
  }

  if (!video) {
    noticeEl.innerHTML = `<span>Video stream tidak tersedia untuk pengisi suara "${source.title}".</span>`;
    if (loaderEl) loaderEl.classList.add('hidden');
    return;
  }

  renderQualityButtons(source.videos);

  noticeEl.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; width: 100%;">
      <span>Memutar: <strong>${source.title}</strong> (${video.quality}p HLS)</span>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <span class="badge-tag badge-genre" style="font-size: 0.72rem;">Buffer Cepat Aktif</span>
        <a href="${video.direct_url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;">
          M3U8 Asli ↗
        </a>
      </div>
    </div>
  `;

  // Destroy previous HLS instance
  if (state.hls) {
    state.hls.destroy();
    state.hls = null;
  }

  if (Hls.isSupported()) {
    state.hls = new Hls({
      maxBufferLength: 90,             // Buffer up to 90 seconds ahead
      maxMaxBufferLength: 300,         // Keep up to 5 minutes in memory
      maxBufferSize: 120 * 1024 * 1024, // 120 MB RAM buffer
      maxBufferHole: 1.5,              // Prevent stall on DTS gap in Kodik streams
      startFragPrefetch: true,         // Prefetch next fragment while current fragment is playing
      progressive: true,               // Progressive playback
      lowLatencyMode: false,           // Deep buffer mode for maximum stability
      backBufferLength: 90,            // Keep 90s backbuffer for instant seek back
      enableWorker: true,
      highBufferWatchdogPeriod: 2,
      nudgeOffset: 0.2,
      nudgeMaxRetry: 10,
      fragLoadingTimeOut: 35000,
      fragLoadingMaxRetry: 8,
      fragLoadingRetryDelay: 500,
      levelLoadingTimeOut: 20000,
      manifestLoadingTimeOut: 20000
    });

    state.hls.loadSource(video.url);
    state.hls.attachMedia(videoEl);

    videoEl.oncanplay = () => { if (loaderEl) loaderEl.classList.add('hidden'); };
    videoEl.onplaying = () => { if (loaderEl) loaderEl.classList.add('hidden'); };
    videoEl.onplay = () => { if (loaderEl) loaderEl.classList.add('hidden'); };

    state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (loaderEl) loaderEl.classList.add('hidden');
      checkAndPromptResume();
      videoEl.play().catch(e => {
        console.log('Autoplay deferred, ready to play via controls:', e);
      });
    });

    state.hls.on(Hls.Events.LEVEL_LOADED, () => {
      if (loaderEl) loaderEl.classList.add('hidden');
    });

    state.hls.on(Hls.Events.ERROR, (event, data) => {
      console.warn('HLS Engine Event:', data);
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            state.hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            state.hls.recoverMediaError();
            break;
          default:
            state.hls.destroy();
            break;
        }
      }
    });
  } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    videoEl.src = video.url;
    videoEl.play();
  }
}

// Render Audio Studio Chips
function renderAudioTracks() {
  if (!audioChipsEl) return;
  audioChipsEl.innerHTML = '';

  state.currentSources.forEach((src, idx) => {
    const chip = document.createElement('button');
    chip.className = `chip-btn ${idx === state.selectedSourceIndex ? 'active' : ''}`;
    chip.innerHTML = src.is_subtitles_original ? 'Original Sub (Jepang)' : src.title;
    chip.title = src.title;
    chip.onclick = () => {
      state.selectedSourceIndex = idx;
      renderAudioTracks();
      playSelectedSource();
    };
    audioChipsEl.appendChild(chip);
  });
}

// Render Video Quality Chips
function renderQualityButtons(videos) {
  if (!qualityChipsEl) return;
  qualityChipsEl.innerHTML = '';

  videos.forEach(v => {
    const q = Number(v.quality);
    const chip = document.createElement('button');
    chip.className = `chip-btn ${q === state.selectedQuality ? 'active' : ''}`;
    chip.textContent = `${q}p`;
    chip.onclick = () => {
      state.selectedQuality = q;
      renderQualityButtons(videos);
      playSelectedSource();
    };
    qualityChipsEl.appendChild(chip);
  });
}

// ================= Subtitles Integration (SubtitleCat) =================
async function fetchSubtitles(title, altTitle, ep) {
  if (!subtitleChipsEl) return;
  subtitleChipsEl.innerHTML = '<span class="spinner" style="width: 14px; height: 14px;"></span> Mencari SubtitleCat...';

  try {
    const res = await fetch(`/api/subtitles/search?title=${encodeURIComponent(title)}&alt_title=${encodeURIComponent(altTitle)}&ep=${ep}`);
    const data = await res.json();
    state.subtitles = data.subtitles || [];
    renderSubtitleChips();
  } catch (err) {
    console.warn('Subtitle error:', err);
    subtitleChipsEl.innerHTML = '<span class="text-dim">Subtitle offline</span>';
  }
}

function renderSubtitleChips() {
  if (!subtitleChipsEl) return;
  subtitleChipsEl.innerHTML = '';

  // Off Button
  const offBtn = document.createElement('button');
  offBtn.className = `chip-btn ${state.selectedSubIndex === -1 ? 'active' : ''}`;
  offBtn.textContent = 'Mati';
  offBtn.onclick = () => {
    state.selectedSubIndex = -1;
    applySubtitleTrack(null);
    renderSubtitleChips();
  };
  subtitleChipsEl.appendChild(offBtn);

  if (state.subtitles.length === 0) {
    const span = document.createElement('span');
    span.style.fontSize = '0.8rem';
    span.style.color = 'var(--text-dim)';
    span.textContent = 'Tidak ditemukan file srt untuk episode ini.';
    subtitleChipsEl.appendChild(span);
    return;
  }

  state.subtitles.forEach((sub, idx) => {
    const chip = document.createElement('button');
    chip.className = `chip-btn ${idx === state.selectedSubIndex ? 'active' : ''}`;
    chip.textContent = sub.label;
    chip.onclick = () => {
      state.selectedSubIndex = idx;
      applySubtitleTrack(sub);
      renderSubtitleChips();
    };
    subtitleChipsEl.appendChild(chip);
  });

  // Auto-activate first subtitle (Indonesian or English)
  if (state.subtitles.length > 0 && state.selectedSubIndex === 0) {
    applySubtitleTrack(state.subtitles[0]);
  }
}

function applySubtitleTrack(sub) {
  if (!videoEl) return;

  const tracks = videoEl.querySelectorAll('track');
  tracks.forEach(t => t.remove());

  if (!sub) return;

  const track = document.createElement('track');
  track.kind = 'subtitles';
  track.label = sub.label;
  track.srclang = sub.lang;
  track.src = sub.vtt_url;
  track.default = true;

  videoEl.appendChild(track);

  if (videoEl.textTracks && videoEl.textTracks.length > 0) {
    for (let i = 0; i < videoEl.textTracks.length; i++) {
      videoEl.textTracks[i].mode = 'showing';
    }
  }
}

// ================= ARM Cross-Database Mapping =================
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

// ================= Recommendations Grid =================
function renderRecommendations(anime) {
  if (!recsGridEl || !anime.recommendations || !anime.recommendations.nodes) return;

  const recs = anime.recommendations.nodes
    .filter(n => n.mediaRecommendation)
    .map(n => n.mediaRecommendation)
    .slice(0, 6);

  if (recs.length === 0) {
    recsGridEl.innerHTML = '<span class="text-dim" style="font-size: 0.85rem;">Tidak ada rekomendasi spesifik.</span>';
    return;
  }

  recsGridEl.innerHTML = recs.map(rec => {
    const title = rec.title?.english || rec.title?.romaji || 'Anime';
    const poster = getSafeImageUrl(rec.coverImage?.large);
    return `
      <a href="/anime.html?id=${rec.id}" target="_blank" class="anime-card" style="text-decoration: none;">
        <div class="card-poster-wrapper">
          <img src="${poster}" alt="${title}" class="card-poster" onerror="this.onerror=null; this.src='/api/image-proxy?url=fallback';" />
        </div>
        <div class="card-content" style="padding: 0.5rem;">
          <h4 style="font-size: 0.8rem; line-height: 1.2; color: #fff;">${title}</h4>
        </div>
      </a>
    `;
  }).join('');
}

// ================= Event Handlers & Controls =================
btnPrev.onclick = () => {
  if (state.currentEpisode > 1) switchEpisode(state.currentEpisode - 1);
};

btnNext.onclick = () => {
  if (state.currentEpisode < state.totalEpisodes) switchEpisode(state.currentEpisode + 1);
};

// Auto-advance when video finishes
videoEl.onended = () => {
  if (autoNextCheck.checked && state.currentEpisode < state.totalEpisodes) {
    switchEpisode(state.currentEpisode + 1);
  }
};

// Search filter in episode list
epSearchInput.oninput = (e) => {
  renderEpisodesSidebar(e.target.value);
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

// Translate synopsis button
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
      localStorage.setItem(`trans_anime_${state.anime.id}`, data.translation);
    }
  } catch (err) {
    txtTranslate.textContent = 'Terjemahkan ke Indonesia';
    alert('Gagal menerjemahkan: ' + err.message);
  }
};

function updateFavoriteButton(id) {
  const saved = isFavorite(id);
  if (txtWatchFav) {
    txtWatchFav.textContent = saved ? 'Tersimpan di Koleksi' : 'Simpan Koleksi';
  }
}

// Keyboard shortcuts for theater player
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (videoEl.paused) videoEl.play(); else videoEl.pause();
      break;
    case 'ArrowRight':
      e.preventDefault();
      videoEl.currentTime = Math.min(videoEl.duration || 9999, videoEl.currentTime + 10);
      break;
    case 'ArrowLeft':
      e.preventDefault();
      videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
      break;
    case 'ArrowUp':
      e.preventDefault();
      videoEl.volume = Math.min(1, videoEl.volume + 0.1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      videoEl.volume = Math.max(0, videoEl.volume - 0.1);
      break;
    case 'KeyF':
      e.preventDefault();
      if (!document.fullscreenElement) {
        document.getElementById('theaterBox').requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
      break;
    case 'KeyM':
      e.preventDefault();
      videoEl.muted = !videoEl.muted;
      break;
  }
});

// ================= Watch History Progress & Resume Tracking =================

function checkAndPromptResume() {
  if (!state.anime) return;
  const saved = getEpisodeProgress(state.anime.id, state.currentEpisode);
  const params = new URLSearchParams(window.location.search);
  const autoResume = params.get('resume') === 'true';

  if (saved && saved.currentTime > 5 && (!saved.duration || saved.currentTime < (saved.duration - 15))) {
    state.savedProgressTime = saved.currentTime;

    if (autoResume) {
      videoEl.currentTime = saved.currentTime;
      videoEl.play().catch(() => {});
      if (noticeEl) {
        noticeEl.innerHTML = `<span>Melanjutkan otomatis di menit <strong>${saved.timeFormatted}</strong> (${saved.progress}%)</span>`;
      }
      return;
    }

    if (resumeTimeTextEl) {
      resumeTimeTextEl.innerHTML = `Sebelumnya menonton sampai menit <strong>${saved.timeFormatted}</strong> (${saved.progress}%)`;
    }
    if (resumeBannerEl) {
      resumeBannerEl.classList.remove('hidden');
      clearTimeout(state.resumePromptTimeout);
      state.resumePromptTimeout = setTimeout(() => {
        resumeBannerEl.classList.add('hidden');
      }, 12000);
    }
  } else {
    state.savedProgressTime = 0;
    if (resumeBannerEl) resumeBannerEl.classList.add('hidden');
  }
}

if (btnResumeYes) {
  btnResumeYes.onclick = () => {
    if (state.savedProgressTime > 0) {
      videoEl.currentTime = state.savedProgressTime;
      videoEl.play().catch(() => {});
      if (noticeEl) {
        noticeEl.innerHTML = `<span>Melanjutkan episode ${state.currentEpisode} di menit <strong>${formatTime(state.savedProgressTime)}</strong></span>`;
      }
    }
    if (resumeBannerEl) resumeBannerEl.classList.add('hidden');
  };
}

if (btnResumeNo) {
  btnResumeNo.onclick = () => {
    videoEl.currentTime = 0;
    videoEl.play().catch(() => {});
    updateWatchProgress(state.anime.id, state.currentEpisode, 0, videoEl.duration || 0);
    if (resumeBannerEl) resumeBannerEl.classList.add('hidden');
  };
}

if (btnResumeDismiss) {
  btnResumeDismiss.onclick = () => {
    if (resumeBannerEl) resumeBannerEl.classList.add('hidden');
  };
}

// Track and update watch progress in real-time
videoEl.addEventListener('timeupdate', () => {
  if (!state.anime || !videoEl.duration || videoEl.duration <= 0) return;

  const cur = videoEl.currentTime;
  const dur = videoEl.duration;
  const pct = Math.min(100, Math.round((cur / dur) * 100));

  // Calculate buffer ahead health
  let bufferedAhead = 0;
  for (let i = 0; i < videoEl.buffered.length; i++) {
    if (videoEl.buffered.start(i) <= cur && cur <= videoEl.buffered.end(i)) {
      bufferedAhead = Math.round(videoEl.buffered.end(i) - cur);
      break;
    }
  }

  // Update badge UI
  if (progressStatusBadge) {
    progressStatusBadge.style.display = 'inline-flex';
    if (watchCurrentTimeText) watchCurrentTimeText.textContent = formatTime(cur);
    if (watchDurationText) watchDurationText.textContent = formatTime(dur);
    if (watchPercentageText) {
      const bufferStatus = bufferedAhead > 10 ? `<span style="color: var(--success); margin-left: 4px;">• Buffer ${bufferedAhead}s (Stabil)</span>` : (bufferedAhead > 0 ? `<span style="color: var(--gold); margin-left: 4px;">• Buffer ${bufferedAhead}s</span>` : '');
      watchPercentageText.innerHTML = `${pct}%${bufferStatus}`;
    }
  }

  // Throttle saving to local storage every 3 seconds or on seek
  if (Math.abs(cur - state.lastSavedTime) >= 3) {
    state.lastSavedTime = cur;
    updateWatchProgress(state.anime.id, state.currentEpisode, cur, dur);
  }
});

videoEl.addEventListener('pause', () => {
  if (state.anime && videoEl.duration > 0 && videoEl.currentTime > 2) {
    updateWatchProgress(state.anime.id, state.currentEpisode, videoEl.currentTime, videoEl.duration);
  }
});

videoEl.addEventListener('seeked', () => {
  if (state.anime && videoEl.duration > 0) {
    updateWatchProgress(state.anime.id, state.currentEpisode, videoEl.currentTime, videoEl.duration);
  }
});

window.addEventListener('beforeunload', () => {
  if (state.anime && videoEl && videoEl.duration > 0 && videoEl.currentTime > 2) {
    updateWatchProgress(state.anime.id, state.currentEpisode, videoEl.currentTime, videoEl.duration);
  }
});

// Run
initWatchPage();

// ==========================================
// AniPulse - Video Player Manager
// Powered by anicli-api (yummy_anime) + Kodik HLS (solodcdn.com)
// Streamed via hls.js with SubtitleCat subtitles
// ==========================================

import Hls from 'hls.js';
import { saveHistory } from './storage.js';
import { getKusonimeDownloads, searchKusonime } from './api.js';

class PlayerManager {
  constructor() {
    this.currentAnime = null;
    this.currentEpisode = 1;
    this.modalElement = null;
    this.videoElement = null;
    this.hls = null;

    // Stream & Subtitle state
    this.currentSources = [];
    this.selectedSourceIndex = 0;
    this.selectedQuality = 720;
    this.subtitles = [];
    this.selectedSubIndex = 0;
    this.armData = null;
  }

  init(modalElement, videoElement) {
    this.modalElement = modalElement;
    this.videoElement = videoElement;
  }

  /**
   * Launch player modal with specific anime and episode
   */
  async open(anime, episodeNumber = 1) {
    this.currentAnime = anime;
    this.currentEpisode = Number(episodeNumber) || 1;

    // Save history
    saveHistory(anime, this.currentEpisode);

    this.renderPlayerUI();
    if (this.modalElement && typeof this.modalElement.showModal === 'function') {
      this.modalElement.showModal();
    }

    // Load direct HLS stream from anicli-api
    await this.loadKodikStream();
  }

  close() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.removeAttribute('src');
      this.videoElement.load();
    }
    if (this.modalElement && this.modalElement.open) {
      this.modalElement.close();
    }
  }

  setEpisode(ep) {
    this.currentEpisode = Number(ep);
    saveHistory(this.currentAnime, this.currentEpisode);
    this.updateEpisodeActiveState();
    this.loadKodikStream();
  }

  nextEpisode() {
    const totalEps = this.currentAnime.episodes || 100;
    if (this.currentEpisode < totalEps) {
      this.setEpisode(this.currentEpisode + 1);
    }
  }

  prevEpisode() {
    if (this.currentEpisode > 1) {
      this.setEpisode(this.currentEpisode - 1);
    }
  }

  /**
   * Fetch stream sources from FastAPI backend using anicli-api (yummy_anime)
   */
  async loadKodikStream() {
    const loader = document.getElementById('playerLoader');
    if (loader) {
      loader.classList.remove('hidden');
      loader.querySelector('p').textContent = 'Memuat direct stream Kodik HLS (anicli-api)...';
    }

    const title = this.currentAnime.title?.english || this.currentAnime.title?.romaji || '';
    const srvNotice = document.getElementById('playerServerNotice');
    if (srvNotice) {
      srvNotice.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; width: 100%;">
          <span>⚡ Menghubungkan ke <strong>YummyAnime & Kodik CDN</strong> via <strong>anicli-api</strong>...</span>
          <span class="badge-tag badge-genre" style="font-size: 0.72rem;">HLS Stream</span>
        </div>
      `;
    }

    try {
      // 1. Fetch streams from anicli-api
      const streamRes = await fetch(`/api/yummy/streams?q=${encodeURIComponent(title)}&ep=${this.currentEpisode}`);
      const streamData = await streamRes.json();

      // 2. Fetch subtitles from SubtitleCat
      this.fetchSubtitles(title, this.currentEpisode);

      // 3. Fetch ARM mapping (TMDB / IMDb / AniDB)
      this.fetchArmMapping(this.currentAnime.id);

      if (!streamData.sources || streamData.sources.length === 0) {
        if (srvNotice) {
          srvNotice.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; width: 100%;">
              <span>⚠️ Stream tidak ditemukan di Kodik untuk judul ini. Mencari dengan kata kunci alternatif...</span>
              <button class="btn btn-secondary btn-sm" id="retryStreamBtn" style="font-size: 0.75rem;">Coba Romaji</button>
            </div>
          `;
          const rBtn = document.getElementById('retryStreamBtn');
          if (rBtn) {
            rBtn.onclick = () => {
              const altTitle = this.currentAnime.title?.romaji || '';
              this.loadAlternativeStream(altTitle);
            };
          }
        }
        if (loader) loader.classList.add('hidden');
        return;
      }

      this.currentSources = streamData.sources;
      this.selectedSourceIndex = 0;

      // Prefer original Japanese subtitles audio track if present
      const subIndex = this.currentSources.findIndex(s => s.is_subtitles_original);
      if (subIndex !== -1) {
        this.selectedSourceIndex = subIndex;
      }

      this.renderAudioTrackButtons();
      this.playSelectedSource();

    } catch (err) {
      console.error('Failed to load Kodik stream:', err);
      if (srvNotice) {
        srvNotice.innerHTML = `<span>⚠️ Gagal menghubungkan ke anicli backend: ${err.message}. Pastikan server backend aktif di port 8000.</span>`;
      }
      if (loader) loader.classList.add('hidden');
    }
  }

  async loadAlternativeStream(title) {
    const streamRes = await fetch(`/api/yummy/streams?q=${encodeURIComponent(title)}&ep=${this.currentEpisode}`);
    const streamData = await streamRes.json();
    if (streamData.sources && streamData.sources.length > 0) {
      this.currentSources = streamData.sources;
      this.selectedSourceIndex = 0;
      this.renderAudioTrackButtons();
      this.playSelectedSource();
    }
  }

  playSelectedSource() {
    const source = this.currentSources[this.selectedSourceIndex];
    if (!source) return;

    const loader = document.getElementById('playerLoader');
    const srvNotice = document.getElementById('playerServerNotice');

    // Find best matching quality (720p, 480p, 360p)
    let video = source.videos.find(v => Number(v.quality) === this.selectedQuality);
    if (!video && source.videos.length > 0) {
      video = source.videos[source.videos.length - 1]; // highest available
      this.selectedQuality = Number(video.quality);
    }

    if (!video) {
      if (srvNotice) {
        srvNotice.innerHTML = `<span>⚠️ Video stream tidak tersedia untuk pengisi suara "${source.title}". Coba pilih pengisi suara lain di bawah.</span>`;
      }
      if (loader) loader.classList.add('hidden');
      return;
    }

    this.renderQualityButtons(source.videos);

    const streamUrl = video.url;
    const directUrl = video.direct_url;

    // Update notice banner
    if (srvNotice) {
      srvNotice.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; width: 100%;">
          <span>🎬 Memutar: <strong>${source.title}</strong> (${video.quality}p HLS) • CDN: <strong>solodcdn.com</strong></span>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <a href="${directUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.25rem 0.65rem;">
              ↗ Buka Stream M3U8
            </a>
          </div>
        </div>
      `;
    }

    // Attach to hls.js
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    if (Hls.isSupported()) {
      this.hls = new Hls({
        maxBufferLength: 60,
        maxMaxBufferLength: 180,
        maxBufferSize: 80 * 1024 * 1024,
        maxBufferHole: 0.5,
        lowLatencyMode: false,
        backBufferLength: 60,
        enableWorker: true,
        fragLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 800,
        levelLoadingTimeOut: 20000,
        manifestLoadingTimeOut: 20000
      });

      this.hls.loadSource(streamUrl);
      this.hls.attachMedia(this.videoElement);

      this.videoElement.oncanplay = () => { if (loader) loader.classList.add('hidden'); };
      this.videoElement.onplaying = () => { if (loader) loader.classList.add('hidden'); };

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (loader) loader.classList.add('hidden');
        this.videoElement.play().catch(e => console.log('Autoplay blocked:', e));
      });

      this.hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn('HLS Event Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              this.hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              this.hls.recoverMediaError();
              break;
            default:
              this.hls.destroy();
              break;
          }
        }
      });
    } else if (this.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      this.videoElement.src = streamUrl;
      this.videoElement.addEventListener('loadedmetadata', () => {
        if (loader) loader.classList.add('hidden');
        this.videoElement.play();
      });
    }
  }

  renderAudioTrackButtons() {
    const container = document.getElementById('playerServerButtons');
    if (!container) return;

    container.innerHTML = '';
    this.currentSources.forEach((src, idx) => {
      const btn = document.createElement('button');
      btn.className = `server-btn ${idx === this.selectedSourceIndex ? 'active' : ''}`;
      
      const icon = src.is_subtitles_original ? '🇯🇵' : '🎙️';
      const badge = src.is_subtitles_original ? 'Audio Asli (Sub)' : 'Sulih Suara';

      btn.innerHTML = `
        <span class="server-icon">${icon}</span>
        <span class="server-text">
          <strong>${src.title}</strong>
          <small>${badge} • ${src.videos.length} Kualitas</small>
        </span>
      `;

      btn.onclick = () => {
        this.selectedSourceIndex = idx;
        this.renderAudioTrackButtons();
        this.playSelectedSource();
      };

      container.appendChild(btn);
    });
  }

  renderQualityButtons(videos) {
    const container = document.getElementById('playerQualityButtons');
    if (!container) return;

    container.innerHTML = '';
    videos.forEach(v => {
      const q = Number(v.quality);
      const btn = document.createElement('button');
      btn.className = `chip-btn ${q === this.selectedQuality ? 'active' : ''}`;
      btn.textContent = `${q}p ${q >= 720 ? 'HD' : 'SD'}`;
      btn.onclick = () => {
        this.selectedQuality = q;
        this.renderQualityButtons(videos);
        this.playSelectedSource();
      };
      container.appendChild(btn);
    });
  }

  async fetchSubtitles(title, ep) {
    const container = document.getElementById('playerSubtitleButtons');
    if (container) {
      container.innerHTML = '<span class="spinner" style="width: 14px; height: 14px;"></span> Mencari subtitle SubtitleCat...';
    }

    const altTitle = this.currentAnime.title?.romaji || '';
    try {
      const res = await fetch(`/api/subtitles/search?title=${encodeURIComponent(title)}&alt_title=${encodeURIComponent(altTitle)}&ep=${ep}`);
      const data = await res.json();
      this.subtitles = data.subtitles || [];
      this.renderSubtitleButtons();
    } catch (e) {
      console.warn('Subtitle fetch error:', e);
      if (container) container.innerHTML = '<span class="text-dim">SubtitleCat offline</span>';
    }
  }

  renderSubtitleButtons() {
    const container = document.getElementById('playerSubtitleButtons');
    if (!container) return;

    container.innerHTML = '';

    // "Off" button
    const offBtn = document.createElement('button');
    offBtn.className = `chip-btn ${this.selectedSubIndex === -1 ? 'active' : ''}`;
    offBtn.textContent = '🚫 Nonaktif';
    offBtn.onclick = () => {
      this.selectedSubIndex = -1;
      this.applySubtitleTrack(null);
      this.renderSubtitleButtons();
    };
    container.appendChild(offBtn);

    if (this.subtitles.length === 0) {
      const emptySpan = document.createElement('span');
      emptySpan.style.fontSize = '0.8rem';
      emptySpan.style.color = 'var(--text-dim)';
      emptySpan.textContent = 'Tidak ditemukan srt di SubtitleCat untuk episode ini.';
      container.appendChild(emptySpan);
      return;
    }

    this.subtitles.forEach((sub, idx) => {
      const btn = document.createElement('button');
      btn.className = `chip-btn ${idx === this.selectedSubIndex ? 'active' : ''}`;
      btn.textContent = sub.label;
      btn.onclick = () => {
        this.selectedSubIndex = idx;
        this.applySubtitleTrack(sub);
        this.renderSubtitleButtons();
      };
      container.appendChild(btn);
    });

    // Auto-apply first subtitle (Indonesian or English) if available
    if (this.subtitles.length > 0 && this.selectedSubIndex === 0) {
      this.applySubtitleTrack(this.subtitles[0]);
    }
  }

  applySubtitleTrack(sub) {
    if (!this.videoElement) return;

    // Remove existing tracks
    const existing = this.videoElement.querySelectorAll('track');
    existing.forEach(t => t.remove());

    if (!sub) return;

    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = sub.label;
    track.srclang = sub.lang;
    track.src = sub.vtt_url;
    track.default = true;

    this.videoElement.appendChild(track);

    if (this.videoElement.textTracks && this.videoElement.textTracks.length > 0) {
      for (let i = 0; i < this.videoElement.textTracks.length; i++) {
        this.videoElement.textTracks[i].mode = 'showing';
      }
    }
  }

  async fetchArmMapping(anilistId) {
    const el = document.getElementById('playerArmInfo');
    if (!el) return;

    try {
      const res = await fetch(`/api/arm/lookup?id=${anilistId}`);
      const arm = await res.json();
      this.armData = arm;

      if (!arm.error) {
        el.innerHTML = `
          <span class="arm-tag">AniList: ${arm.anilist || anilistId}</span>
          <span class="arm-tag">MAL: ${arm.myanimelist || '-'}</span>
          <span class="arm-tag">IMDb: ${arm.imdb || '-'}</span>
          <span class="arm-tag">AniDB: ${arm.anidb || '-'}</span>
          <span class="arm-tag">Kitsu: ${arm.kitsu || '-'}</span>
        `;
      } else {
        el.innerHTML = `<span class="arm-tag">AniList ID: ${anilistId}</span>`;
      }
    } catch (e) {
      el.innerHTML = `<span class="arm-tag">AniList ID: ${anilistId}</span>`;
    }
  }

  renderPlayerUI() {
    const anime = this.currentAnime;
    const title = anime.title?.english || anime.title?.romaji || 'Anime';

    // 1. Update Title and metadata
    const titleEl = document.getElementById('playerModalTitle');
    if (titleEl) titleEl.textContent = `${title} — Episode ${this.currentEpisode}`;

    // 2. Episode Grid (Real-time calculation: never show future unreleased episodes for ongoing anime)
    const epContainer = document.getElementById('playerEpisodeGrid');
    if (epContainer) {
      epContainer.innerHTML = '';
      let totalEps = 1;
      if (anime.status === 'RELEASING') {
        if (anime.nextAiringEpisode && anime.nextAiringEpisode.episode) {
          totalEps = Math.max(1, anime.nextAiringEpisode.episode - 1);
        } else if (anime.episodes) {
          totalEps = anime.episodes;
        }
      } else {
        totalEps = anime.episodes || 12;
      }

      for (let i = 1; i <= totalEps; i++) {
        const epBtn = document.createElement('button');
        epBtn.className = `ep-pill ${i === this.currentEpisode ? 'active' : ''}`;
        epBtn.dataset.ep = i;
        epBtn.textContent = `Ep ${i}`;
        epBtn.onclick = () => this.setEpisode(i);
        epContainer.appendChild(epBtn);
      }
    }

    // 3. Load Kusonime Batch Downloads
    this.loadBatchDownloads();
  }

  updateEpisodeActiveState() {
    const pills = document.querySelectorAll('.ep-pill');
    pills.forEach(p => {
      p.classList.toggle('active', Number(p.dataset.ep) === this.currentEpisode);
    });
  }

  async loadBatchDownloads() {
    const container = document.getElementById('playerDownloadLinks');
    if (!container) return;

    container.innerHTML = '<div class="download-loading"><span class="spinner"></span> Mencari link download batch Sub Indo...</div>';

    try {
      const searchTerm = this.currentAnime.title?.romaji || this.currentAnime.title?.english;
      const kusoResults = await searchKusonime(searchTerm, 3);

      if (!kusoResults || kusoResults.length === 0) {
        container.innerHTML = `
          <div class="download-empty">
            <p>Tidak ditemukan batch download spesifik di Kusonime untuk anime ini.</p>
            <a href="https://kusonime.com/?s=${encodeURIComponent(searchTerm)}" target="_blank" class="btn btn-secondary btn-sm">
              Cari manual di Kusonime ↗
            </a>
          </div>
        `;
        return;
      }

      const post = kusoResults[0];
      const downloads = await getKusonimeDownloads(post.link);

      if (!downloads || downloads.length === 0) {
        container.innerHTML = `
          <div class="download-direct">
            <h4>${post.title}</h4>
            <a href="${post.link}" target="_blank" class="btn btn-primary btn-sm">Buka Halaman Download Kusonime ↗</a>
          </div>
        `;
        return;
      }

      let html = `<div class="download-title"><strong>${post.title}</strong></div><div class="quality-blocks">`;
      downloads.forEach(dl => {
        html += `
          <div class="quality-row">
            <span class="quality-tag">${dl.quality}</span>
            <div class="dl-hosts">
              ${dl.links.map(l => `
                <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="host-badge">
                  💾 ${l.host}
                </a>
              `).join('')}
            </div>
          </div>
        `;
      });
      html += '</div>';

      container.innerHTML = html;
    } catch (err) {
      console.warn('Failed to load batch downloads:', err);
      container.innerHTML = '<p class="text-muted">Gagal memuat opsi download batch.</p>';
    }
  }
}

export const player = new PlayerManager();

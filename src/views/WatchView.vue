<template>
  <div class="watch-page-container">
    <div class="theater-main">
      
      <!-- Top Breadcrumb Bar (Clean mobile-native back link) -->
      <div class="theater-breadcrumb-bar">
        <router-link to="/" class="bc-link">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <span class="bc-anime-title">{{ cleanRussianTitle(anime?.title?.english || anime?.title?.romaji) || 'Kembali ke Beranda' }}</span>
        </router-link>
      </div>

      <!-- Video Player Viewport -->
      <div 
        class="theater-player-box" 
        id="theaterBox"
        :class="{ 
          'controls-active': isPlayerHovered, 
          'is-theater-fullscreen': isTheaterFullscreen,
          'is-forced-landscape-css': isForcedLandscapeCss
        }"
        @mousemove="onPlayerMouseMove"
        @mouseleave="onPlayerMouseLeave"
      >
        <!-- Floating Cinema Top Action Bar (Rotate & Fullscreen) -->
        <div v-if="isAuthenticated" class="cinema-top-action-bar">
          <!-- Manual Rotate Screen Button (Landscape Mereng Toggle) -->
          <button 
            v-if="isTheaterFullscreen"
            type="button" 
            class="cinema-action-btn cinema-rotate-btn" 
            @click.stop="toggleOrientationMode"
            :title="isForcedLandscapeCss ? 'Layar Tegak (Portrait)' : 'Putar Layar Penuh (Landscape Mereng)'"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
              <path d="M16 21h5v-5"/>
            </svg>
            <span class="fs-label">{{ isForcedLandscapeCss ? 'Tegak' : 'Putar Mereng' }}</span>
          </button>

          <!-- Cinema Fullscreen Toggle Button -->
          <button 
            type="button" 
            class="cinema-action-btn cinema-fullscreen-toggle-btn" 
            @click.stop="toggleTheaterFullscreen"
            :title="isTheaterFullscreen ? 'Keluar Layar Penuh (ESC)' : 'Layar Penuh (Sub Indo Aktif)'"
          >
            <svg v-if="!isTheaterFullscreen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
            </svg>
            <span class="fs-label">{{ isTheaterFullscreen ? 'Keluar' : 'Layar Penuh' }}</span>
          </button>
        </div>
        <!-- Embed Player (Cloud Direct Stream Fallback for Mobile Data / Remote) -->
        <iframe 
          v-if="isCurrentSourceEmbed"
          :src="currentEmbedUrl"
          class="native-hls-player embed-cloud-frame"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowfullscreen
          frameborder="0"
        ></iframe>

        <!-- Direct HLS / MP4 Player (Single Native Player - Kodik / AniLibria) -->
        <video 
          v-else
          ref="videoRef" 
          class="native-hls-player" 
          controls 
          crossorigin="anonymous"
          playsinline 
          webkit-playsinline
          x5-playsinline
          preload="auto"
          @timeupdate="onTimeUpdate"
          @ended="onVideoEnded"
          @play="onVideoPlay"
          @playing="onVideoPlaying"
          @canplay="onVideoCanPlay"
          @pause="onVideoPause"
          @seeked="onVideoSeeked"
        ></video>

        <!-- Direct Subtitle Timpa Overlay (Overwrites Russian hardsub with clean Indonesian fansub text) -->
        <div v-if="currentSubtitleCueText" class="cinema-subtitle-overlay">
          <span class="cinema-subtitle-box" v-html="currentSubtitleCueText"></span>
        </div>

        <!-- VIP Locked Access Screen (Displayed when user is not logged in) -->
        <div v-if="!isAuthenticated" class="vip-locked-theater-overlay">
          <div class="vip-locked-backdrop-glow"></div>
          <div class="vip-locked-card">
            <div class="vip-locked-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e50914" stroke-width="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <span>AKSES KHUSUS VIP & UNDANGAN</span>
            </div>
            
            <h2 class="vip-locked-title">Streaming Video Terkunci</h2>
            <p class="vip-locked-desc">
              Aplikasi ini bersifat privat khusus anggota terdaftar. Masuk dengan akun yang dibuatkan Admin atau klaim Kode Undangan resmi untuk mulai menonton anime.
            </p>

            <div class="vip-locked-actions">
              <button class="btn btn-primary vip-btn-glow" @click="showLoginModal = true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                  <polyline points="10 17 15 12 10 7"></polyline>
                  <line x1="15" y1="12" x2="3" y2="12"></line>
                </svg>
                <span>Masuk Akun VIP</span>
              </button>

              <button class="btn btn-secondary vip-btn-invite" @click="showInviteModal = true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2">
                  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"></path>
                  <line x1="12" y1="9" x2="12" y2="15"></line>
                </svg>
                <span>Klaim Kode Undangan</span>
              </button>
            </div>
            
            <div class="vip-locked-footer-hint">
              <span>👑 Dikelola oleh Admin &bull; Akses Terbatas & Privat</span>
            </div>
          </div>
        </div>


        <!-- Floating Skip Opening Overlay Button (Appears during opening 0:00 - 3:00) -->
        <transition name="fade-scale">
          <button 
            v-if="canShowSkipOpOverlay" 
            class="skip-op-overlay-btn" 
            @click.stop="skipOpening(false)"
            title="Lompati lagu opening 85 detik"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <polygon points="11 4 21 12 11 20 11 4"></polygon>
            </svg>
            <span>Lewati Opening (+85s)</span>
          </button>
        </transition>

        <!-- Toast Notification (Opening dilewati +85s) -->
        <transition name="toast-slide">
          <div v-if="showSkipToast" class="player-action-toast">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <polygon points="11 4 21 12 11 20 11 4"></polygon>
            </svg>
            <span>{{ skipToastMessage }}</span>
          </div>
        </transition>

        <!-- Floating Resume Prompt Banner -->
        <div v-if="showResumeBanner" class="watch-resume-banner">
          <div class="resume-banner-info">
            <div>
              <p class="resume-title">Lanjutkan Tontonan?</p>
              <p class="resume-subtitle">Sebelumnya sampai menit <strong>{{ formatTime(savedResumeTime) }}</strong> ({{ resumePercentage }}%)</p>
            </div>
          </div>
          <div class="resume-banner-actions">
            <button class="btn btn-primary btn-sm" @click="applyResume(true)">Lanjutkan</button>
            <button class="btn btn-secondary btn-sm" @click="applyResume(false)" style="font-size: 0.75rem; padding: 0.35rem 0.6rem;">Dari Awal</button>
            <button class="resume-close-btn" @click="showResumeBanner = false" title="Tutup">✕</button>
          </div>
        </div>

        <!-- Non-blocking Loading State -->
        <div v-if="isLoadingStream && !showPlayOverlay" class="player-loader">
          <span class="spinner" style="width: 34px; height: 34px; border-width: 3px;"></span>
          <p style="margin-top: 0.75rem; font-size: 0.88rem; font-weight: 600;">{{ loadingMessage || 'Menghubungkan ke stream video Kodik...' }}</p>
        </div>

        <!-- Manual Play Button Overlay if Autoplay Deferred -->
        <div v-if="showPlayOverlay" class="manual-play-overlay" @click="startManualPlayback">
          <div class="manual-play-icon">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </div>
          <span class="manual-play-text">Klik untuk Memutar Video (Episode {{ currentEpisode }})</span>
        </div>
      </div>

      <!-- Episode Heading, Total Count & Actions Row (Matching User's Screenshot) -->
      <div class="theater-title-row">
        <div class="title-left">
          <h1 class="episode-heading">
            Episode {{ currentEpisode }}
            <span class="total-ep-accent">{{ totalEpisodes }} ep</span>
          </h1>
        </div>
        <div class="title-actions">
          <button class="btn-skip-pill" @click="skipOpening(false)" title="Lompati lagu intro opening 85 detik">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <polygon points="11 4 21 12 11 20 11 4"></polygon>
            </svg>
            <span>Skip Opening</span>
          </button>
          <button class="btn-fav-pill" @click="handleToggleFavorite" :class="{ 'is-saved': isFav }" :title="isFav ? 'Tersimpan di koleksi' : 'Simpan ke koleksi'">
            <svg width="14" height="14" viewBox="0 0 24 24" :fill="isFav ? '#ff4d2e' : 'none'" :stroke="isFav ? '#ff4d2e' : 'currentColor'" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            <span>{{ isFav ? 'Tersimpan' : 'Koleksi' }}</span>
          </button>
        </div>
      </div>

      <!-- Versi (Server / Audio Dub) & Stream Settings Row -->
      <div class="theater-version-container">
        <!-- Only show source dropdown if there are multiple alternative sources -->
        <div class="version-item" v-if="currentSources.length > 1">
          <label class="version-label">Server Video</label>
          <div class="version-select-box">
            <select 
              v-model="selectedSourceIndex" 
              @change="switchSource(selectedSourceIndex)" 
              class="version-native-select"
            >
              <option 
                v-for="(src, idx) in currentSources" 
                :key="idx" 
                :value="idx"
              >
                {{ cleanSourceTitle(src.title) || `Server ${idx + 1}` }}
              </option>
            </select>
            <div class="version-chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
        </div>

        <!-- Quality selector -->
        <div class="version-item" v-if="availableVideos.length > 0">
          <label class="version-label">Resolusi</label>
          <div class="version-select-box">
            <select 
              v-model="selectedQuality" 
              @change="switchQuality(selectedQuality)" 
              class="version-native-select"
            >
              <option v-for="v in availableVideos" :key="v.quality" :value="Number(v.quality)">
                {{ v.quality }}p {{ v.type === 'mp4' ? 'Direct MP4' : 'HD' }}
              </option>
            </select>
            <div class="version-chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
        </div>

        <!-- Subtitle selector -->
        <div class="version-item" v-if="subtitlesList.length > 0">
          <label class="version-label">Subtitle</label>
          <div class="version-select-box">
            <select 
              v-model="selectedSubIndex" 
              @change="switchSubtitle(selectedSubIndex)" 
              class="version-native-select"
            >
              <option :value="-1">Mati (Tanpa Subtitle)</option>
              <option v-for="(sub, sIdx) in subtitlesList" :key="sIdx" :value="sIdx">
                {{ sub.label }}
              </option>
            </select>
            <div class="version-chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
        </div>

        <!-- Subtitle Sync / Direct Timpa Calibration Control -->
        <div class="version-item subtitle-sync-control" v-if="selectedSubIndex !== -1 && subtitlesList.length > 0">
          <label class="version-label">
            Sinkronisasi Timpa Teks
            <span class="sync-offset-badge" :class="{ 'is-shifted': subtitleOffset !== 0 }">
              {{ subtitleOffset > 0 ? '+' : '' }}{{ subtitleOffset.toFixed(1) }}s {{ subtitleOffset > 0 ? '(Maju)' : subtitleOffset < 0 ? '(Mundur)' : '(Pas Timpa)' }}
            </span>
          </label>
          <div class="sub-sync-btn-group">
            <button type="button" class="btn-sync-step btn-sync-faster" @click="adjustSubtitleOffset(0.5)" title="Munculkan subtitle 0.5 detik lebih awal">+0.5s Maju</button>
            <button type="button" class="btn-sync-step" @click="adjustSubtitleOffset(0.2)" title="Munculkan subtitle 0.2 detik lebih awal">+0.2s</button>
            <button type="button" class="btn-sync-step btn-sync-reset" @click="resetSubtitleOffset" title="Reset sinkronisasi ke pas timpa (0.0s)">0.0s Pas</button>
            <button type="button" class="btn-sync-step" @click="adjustSubtitleOffset(-0.2)" title="Tunda subtitle 0.2 detik lebih mundur">-0.2s</button>
            <button type="button" class="btn-sync-step btn-sync-slower" @click="adjustSubtitleOffset(-0.5)" title="Tunda subtitle 0.5 detik lebih mundur">-0.5s Mundur</button>
          </div>
        </div>
      </div>

      <!-- Episode Picker Grid (Matches Miru buttons: 1, 2, 3... right under Versi) -->
      <div class="theater-episodes-section">
        <!-- If total episodes > 25, show range chunks -->
        <div class="ep-chunk-tabs" v-if="episodeChunks.length > 1">
          <button 
            v-for="(chunk, cIdx) in episodeChunks" 
            :key="cIdx"
            class="chunk-tab-btn"
            :class="{ active: currentChunkIndex === cIdx }"
            @click="currentChunkIndex = cIdx"
          >
            {{ chunk.label }}
          </button>
        </div>

        <div class="theater-ep-cards-grid">
          <button 
            v-for="ep in visibleEpisodes" 
            :key="ep.num"
            class="ep-card-btn"
            :class="{ active: currentEpisode === ep.num }"
            @click="switchEpisode(ep.num)"
          >
            {{ ep.num }}
          </button>
        </div>
      </div>

      <!-- Episode Quick Navigation & Auto Options -->
      <div class="ep-nav-toolbar">
        <div class="ep-nav-buttons">
          <button 
            class="btn btn-secondary btn-sm nav-btn" 
            :disabled="currentEpisode <= 1"
            @click="switchEpisode(currentEpisode - 1)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Episode Sebelumnya</span>
          </button>
          
          <button 
            class="btn btn-primary btn-sm nav-btn" 
            :disabled="currentEpisode >= totalEpisodes"
            @click="switchEpisode(currentEpisode + 1)"
          >
            <span>Episode Berikutnya</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>

        <div class="player-switches-group">
          <label class="auto-switch-label">
            <input type="checkbox" v-model="autoSkipOp" @change="onAutoSkipOpChanged" style="accent-color: #ff4d2e;" />
            <span>Auto-Skip Opening (+85s)</span>
          </label>
          <label class="auto-switch-label">
            <input type="checkbox" v-model="autoNext" style="accent-color: #ff4d2e;" />
            <span>Putar Otomatis Next</span>
          </label>
        </div>
      </div>

      <!-- Real-time Watch Progress Tracker & Stream Status Notice -->
      <div class="stream-notice-row">
        <div class="player-server-notice">
          <span>{{ streamStatusText || `Memuat stream Episode ${currentEpisode}...` }}</span>
          <span class="badge-tag badge-genre" v-if="isBufferingStable" style="font-size: 0.72rem; margin-left: 6px;">Buffer Stabil</span>
          <a 
            v-if="activeDirectUrl" 
            :href="activeDirectUrl" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn btn-secondary btn-sm btn-m3u8"
            title="Buka link m3u8 asli di tab baru"
          >
            M3U8 Asli ↗
          </a>
        </div>
        
        <div class="watch-progress-badge" v-if="watchDuration > 0">
          Posisi: <strong style="color: #fff; margin-left: 3px;">{{ formatTime(watchCurrentTime) }}</strong> / {{ formatTime(watchDuration) }} ({{ watchPercentage }}% <span class="buffer-text">• Cache Line: {{ bufferAheadSec }}s</span>)
        </div>
      </div>

      <!-- Real-time Cache Line Visual Bar -->
      <div class="cache-line-container" v-if="watchDuration > 0">
        <div class="cache-line-track">
          <div class="cache-line-playhead" :style="{ width: watchPercentage + '%' }"></div>
          <div class="cache-line-buffer" :style="{ left: watchPercentage + '%', width: Math.min(100 - watchPercentage, Math.round((bufferAheadSec / watchDuration) * 100)) + '%' }"></div>
        </div>
        <div class="cache-line-labels">
          <span class="cache-label-left">Stream Cache Line (Kodik solodcdn.com HLS Proxy)</span>
          <span class="cache-label-right" :style="{ color: bufferAheadSec >= 10 ? '#10b981' : '#f59e0b' }">
            {{ bufferAheadSec >= 10 ? 'Buffer Stabil (+ ' + bufferAheadSec + 's tersimpan di RAM)' : (bufferAheadSec > 0 ? 'Sedang memuat buffer (' + bufferAheadSec + 's)' : 'Memuat data HLS...') }}
          </span>
        </div>
      </div>

      <!-- Anime Metadata & Synopsis Card -->
      <div class="watch-info-card" v-if="anime">
        <div class="watch-info-header">
          <div class="watch-title-group">
            <h2 class="anime-main-title">{{ cleanRussianTitle(anime.title?.english || anime.title?.romaji) }}</h2>
            <p class="anime-alt-title">{{ cleanRussianTitle(anime.title?.romaji) }} <span v-if="anime.title?.native">({{ cleanRussianTitle(anime.title?.native) }})</span></p>
          </div>
        </div>

        <!-- Catch Line Badges Row -->
        <div class="watch-badges-row">
          <span class="badge-tag badge-score" v-if="anime.averageScore">★ {{ (anime.averageScore / 10).toFixed(1) }}</span>
          <span class="badge-tag badge-genre">{{ anime.format || 'TV' }}</span>
          <span class="badge-tag badge-genre" :class="{ 'badge-ongoing': anime.status === 'RELEASING' }">
            {{ anime.status === 'RELEASING' ? 'Sedang Rilis' : 'Tamat' }}
          </span>
          <span class="badge-tag badge-genre" v-if="anime.studios?.nodes?.[0]?.name">
            {{ anime.studios.nodes[0].name }}
          </span>
          <span class="badge-tag badge-genre badge-ep-count">{{ totalEpisodes }} Episode</span>
        </div>

        <!-- Dedicated Genre Tags Row -->
        <div class="dashboard-genre-tags" v-if="anime.genres && anime.genres.length > 0">
          <span class="genre-label">Genre:</span>
          <router-link 
            v-for="g in anime.genres" 
            :key="g" 
            :to="`/?genre=${encodeURIComponent(g)}`" 
            class="genre-pill" 
            :title="`Filter anime genre ${g}`"
          >
            {{ g }}
          </router-link>
        </div>

        <!-- Cross-Database ARM Mapping -->
        <div class="watch-arm-badges" v-if="armMapping">
          <span class="arm-tag" v-if="armMapping.anilist">AniList: {{ armMapping.anilist }}</span>
          <span class="arm-tag" v-if="armMapping.myanimelist">MAL: {{ armMapping.myanimelist }}</span>
          <span class="arm-tag" v-if="armMapping.themoviedb">TMDB: {{ armMapping.themoviedb }}</span>
          <span class="arm-tag" v-if="armMapping.imdb">IMDb: {{ armMapping.imdb }}</span>
        </div>

        <!-- Synopsis with Real-time Translation -->
        <div class="synopsis-section">
          <div class="synopsis-top-bar">
            <span class="synopsis-heading">Sinopsis</span>
            <div class="synopsis-actions">
              <span v-if="isIndonesian && isServerCached" class="cached-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"></path></svg>
                <span>Tersimpan di Server</span>
              </span>
              <button class="btn btn-secondary btn-sm btn-translate" :disabled="isTranslating" @click="toggleTranslate">
                <span v-if="isTranslating" class="spinner-tiny"></span>
                <span>{{ isTranslating ? 'Menerjemahkan...' : (isIndonesian ? 'Lihat Bahasa Asli' : 'Terjemahkan ke Indonesia') }}</span>
              </button>
            </div>
          </div>
          <div class="synopsis-box">{{ currentSynopsis || 'Sinopsis belum tersedia.' }}</div>
        </div>

        <!-- Batch Download Links from Kusonime -->
        <div class="batch-downloads-section" v-if="kusonimeDownloads.length > 0">
          <h3 class="section-subheading">Download Batch (Subtitle Indonesia)</h3>
          <div class="downloads-container">
            <div v-for="(dl, dIdx) in kusonimeDownloads" :key="dIdx" class="download-box">
              <div class="download-quality-title">Resolusi: {{ dl.quality }}</div>
              <div class="download-links-list">
                <a 
                  v-for="(link, lIdx) in dl.links" 
                  :key="lIdx" 
                  :href="link.url" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="legal-badge"
                >
                  {{ link.host }} ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rekomendasi Anime Terkait -->
      <div class="watch-info-card" v-if="recommendationsList.length > 0">
        <h3 class="section-subheading">Anime Terkait</h3>
        <div class="recs-grid">
          <div 
            v-for="item in recommendationsList" 
            :key="item.id" 
            class="rec-card"
            @click="navigateToAnime(item.id)"
          >
            <div class="rec-poster-box">
              <img :src="getSafeImageUrl(item.coverImage?.large)" :alt="item.title?.romaji" class="rec-poster" />
              <span class="rec-score-badge" v-if="item.averageScore">★ {{ (item.averageScore / 10).toFixed(1) }}</span>
            </div>
            <div class="rec-info">
              <h4 class="rec-title">{{ item.title?.english || item.title?.romaji }}</h4>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Hls from 'hls.js';
import { 
  getAnimeDetails, 
  getSafeImageUrl, 
  lookupTranslation, 
  translateSynopsis, 
  searchKusonime, 
  getKusonimeDownloads,
  apiUrl,
  getAuthToken,
  safeFetchJson,
  getEffectiveEpisodeCount,
  isAiringStatus,
  isMobileNativeApp,
  fetchClientDirectEpisodes,
  fetchClientDirectStreams,
  cleanRussianTitle,
  cleanSourceTitle,
  getPresetSubtitles
} from '../api.js';
import { 
  isAuthenticated, 
  showLoginModal, 
  showInviteModal 
} from '../stores/auth.js';
import { 
  saveHistory, 
  updateWatchProgress, 
  getEpisodeProgress, 
  formatTime, 
  isFavorite, 
  toggleFavorite 
} from '../storage.js';
import { ScreenOrientation } from '@capacitor/screen-orientation';

const route = useRoute();
const router = useRouter();

const videoRef = ref(null);
let hlsInstance = null;
let safetyTimer = null;

const anime = ref(null);
const currentEpisode = ref(Number(route.query.ep) || 1);
const totalEpisodes = ref(1);
const episodesList = ref([]);
const epSearchQuery = ref('');
const autoNext = ref(true);
const airingNotice = ref('');

// Skip Opening & Mobile Episode Chunking
const autoSkipOp = ref(localStorage.getItem('anipulse_auto_skip_op') === 'true');
const showSkipToast = ref(false);
const skipToastMessage = ref('');
const hasAutoSkippedThisEp = ref(false);
const currentChunkIndex = ref(0);

const canShowSkipOpOverlay = computed(() => {
  return watchCurrentTime.value > 0.5 && watchCurrentTime.value <= 180 && !isLoadingStream.value;
});

const episodeChunks = computed(() => {
  const chunks = [];
  const total = totalEpisodes.value || 1;
  const chunkSize = 25;
  for (let i = 0; i < total; i += chunkSize) {
    const start = i + 1;
    const end = Math.min(i + chunkSize, total);
    chunks.push({
      start,
      end,
      label: `${start} - ${end}`
    });
  }
  return chunks;
});

const visibleEpisodes = computed(() => {
  if (totalEpisodes.value <= 25) {
    return episodesList.value;
  }
  const chunk = episodeChunks.value[currentChunkIndex.value];
  if (!chunk) return episodesList.value;
  return episodesList.value.filter(e => e.num >= chunk.start && e.num <= chunk.end);
});

function onAutoSkipOpChanged() {
  localStorage.setItem('anipulse_auto_skip_op', autoSkipOp.value ? 'true' : 'false');
}

function skipOpening(isAuto = false) {
  if (isCurrentSourceEmbed.value) {
    skipToastMessage.value = 'Fitur Skip Opening tersedia langsung di dalam pemutar Kodik';
    showSkipToast.value = true;
    setTimeout(() => {
      showSkipToast.value = false;
    }, 2500);
    return;
  }
  const videoEl = videoRef.value;
  if (!videoEl) return;
  const target = Math.min((videoEl.duration || Infinity), videoEl.currentTime + 85);
  videoEl.currentTime = target;
  hasAutoSkippedThisEp.value = true;
  skipToastMessage.value = isAuto ? 'Auto-Skip: Lewati Opening (+85s)' : 'Opening dilewati (+85s)';
  showSkipToast.value = true;
  setTimeout(() => {
    showSkipToast.value = false;
  }, 2200);
}

const currentSources = ref([]);
const isCurrentSourceEmbed = ref(false);
const currentEmbedUrl = ref('');
const selectedSourceIndex = ref(0);
const selectedQuality = ref(720);
const availableVideos = ref([]);
const subtitlesList = ref([]);
const selectedSubIndex = ref(-1);
const isSearchingSubtitles = ref(false);
const activeSubtitleCues = ref([]);
const currentSubtitleCueText = ref('');
const subtitleOffset = ref(0.0); // Default 0.0s (exact audio sync), calibrated via effectiveTime = cur + offset
let rafSubId = null;

const autoMaskRussian = ref(true);
try {
  const savedMask = localStorage.getItem('anipulse_auto_mask_russian');
  if (savedMask !== null) {
    autoMaskRussian.value = savedMask === 'true';
  }
} catch (e) {}

function toggleMaskRussian(val) {
  autoMaskRussian.value = val;
  try {
    localStorage.setItem('anipulse_auto_mask_russian', String(val));
  } catch (e) {}
}

const isPlayerHovered = ref(false);
let playerHoverTimer = null;
function onPlayerMouseMove() {
  isPlayerHovered.value = true;
  clearTimeout(playerHoverTimer);
  playerHoverTimer = setTimeout(() => {
    isPlayerHovered.value = false;
  }, 2500);
}
function onPlayerMouseLeave() {
  isPlayerHovered.value = false;
  clearTimeout(playerHoverTimer);
}

// ---------------- Cinema Fullscreen & Screen Orientation Controller ----------------
const isTheaterFullscreen = ref(false);
const isForcedLandscapeCss = ref(false);

async function toggleOrientationMode() {
  if (isForcedLandscapeCss.value) {
    isForcedLandscapeCss.value = false;
  } else {
    isForcedLandscapeCss.value = true;
    try {
      await ScreenOrientation.lock({ orientation: 'landscape' });
    } catch (_) {}
  }
}

async function toggleTheaterFullscreen() {
  const theater = document.getElementById('theaterBox');
  if (!theater) return;

  const currentFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || isTheaterFullscreen.value);

  if (!currentFs) {
    isTheaterFullscreen.value = true;
    try {
      if (theater.requestFullscreen) {
        await theater.requestFullscreen();
      } else if (theater.webkitRequestFullscreen) {
        await theater.webkitRequestFullscreen();
      }
    } catch (err) {
      console.warn('Native requestFullscreen failed, active CSS full-screen fallback:', err);
    }

    // 1. Force hardware screen orientation to Landscape (mereng)
    try {
      await ScreenOrientation.lock({ orientation: 'landscape' });
    } catch (e1) {
      try {
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape');
        }
      } catch (_) {}
    }

    // 2. Fallback: if user device has system orientation lock on, apply CSS rotation
    setTimeout(() => {
      if (isTheaterFullscreen.value && window.innerHeight > window.innerWidth) {
        isForcedLandscapeCss.value = true;
      }
    }, 280);

  } else {
    isTheaterFullscreen.value = false;
    isForcedLandscapeCss.value = false;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      }
    } catch (_) {}
    try {
      await ScreenOrientation.unlock();
    } catch (e2) {
      try {
        if (screen.orientation && screen.orientation.unlock) {
          screen.orientation.unlock();
        }
      } catch (_) {}
    }
  }
}

function handleFullscreenChange() {
  const fsElem = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
  const theater = document.getElementById('theaterBox');
  if (!theater) return;

  if (fsElem) {
    if (fsElem !== theater && theater.contains(fsElem)) {
      // Kodik iframe or native video requested fullscreen alone!
      // Escalate to theaterBox so Indonesian subtitle overlay stays on top!
      try {
        if (document.exitFullscreen) {
          document.exitFullscreen().then(() => {
            isTheaterFullscreen.value = true;
            setTimeout(() => {
              if (theater.requestFullscreen) theater.requestFullscreen().catch(() => {});
              else if (theater.webkitRequestFullscreen) theater.webkitRequestFullscreen().catch(() => {});
            }, 50);
          }).catch(() => {
            isTheaterFullscreen.value = true;
          });
        }
      } catch (_) {
        isTheaterFullscreen.value = true;
      }
      return;
    }
    isTheaterFullscreen.value = true;
  } else {
    isTheaterFullscreen.value = false;
  }
}

const isLoadingStream = ref(true);
const loadingMessage = ref('Menghubungkan ke stream video Kodik...');
const streamStatusText = ref('');
const showPlayOverlay = ref(false);
const isBufferingStable = ref(false);
const bufferAheadSec = ref(0);

const watchCurrentTime = ref(0);
const watchDuration = ref(0);
const lastSavedTime = ref(0);

const originalSynopsis = ref('');
const indonesianSynopsis = ref('');
const isIndonesian = ref(false);
const isTranslating = ref(false);
const isServerCached = ref(false);

const isFav = ref(false);
const showResumeBanner = ref(false);
const savedResumeTime = ref(0);
const armMapping = ref(null);
const kusonimeDownloads = ref([]);

const filteredEpisodes = computed(() => {
  const q = epSearchQuery.value.trim().toLowerCase();
  if (!q) return episodesList.value;
  return episodesList.value.filter(e => String(e.num).includes(q));
});

const currentSynopsis = computed(() => {
  if (isIndonesian.value && indonesianSynopsis.value) {
    return indonesianSynopsis.value;
  }
  return originalSynopsis.value;
});

const activeDirectUrl = computed(() => {
  const source = currentSources.value[selectedSourceIndex.value];
  if (!source || !source.videos) return '';
  const video = source.videos.find(v => Number(v.quality) === selectedQuality.value) || source.videos[0];
  return video?.direct_url || '';
});

const recommendationsList = computed(() => {
  if (!anime.value?.recommendations?.nodes) return [];
  return anime.value.recommendations.nodes
    .map(n => n.mediaRecommendation)
    .filter(Boolean)
    .slice(0, 6);
});

const watchPercentage = computed(() => {
  if (watchDuration.value <= 0) return 0;
  return Math.min(100, Math.round((watchCurrentTime.value / watchDuration.value) * 100));
});

const resumePercentage = computed(() => {
  if (watchDuration.value <= 0 || savedResumeTime.value <= 0) return 0;
  return Math.min(100, Math.round((savedResumeTime.value / watchDuration.value) * 100));
});

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
}

// ---------------- Episode Count Logic ----------------
function computeEpisodeCount(details) {
  airingNotice.value = '';
  const isAiring = isAiringStatus(details);
  const count = getEffectiveEpisodeCount(details);

  if (isAiring) {
    if (details.nextAiringEpisode && details.nextAiringEpisode.episode) {
      const hours = Math.floor(details.nextAiringEpisode.timeUntilAiring / 3600);
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      const timeStr = days > 0 ? `${days} hari ${remHours} jam` : `${hours} jam`;
      airingNotice.value = `Episode ${details.nextAiringEpisode.episode} rilis dalam ${timeStr}`;
    } else {
      airingNotice.value = `Episode ${count + 1} tayang sesuai jadwal resmi`;
    }
  }

  totalEpisodes.value = count;
  episodesList.value = Array.from({ length: count }, (_, i) => ({
    num: i + 1,
    title: `Episode ${i + 1}`
  }));
}

// Query YummyAnime server for exact stream episodes
async function fetchYummyEpisodes(details) {
  const searchTerm = details.title?.english || details.title?.romaji;
  const altTerm = details.title?.romaji || '';
  const yummyId = details.yummyId || '';
  const slug = details.slug || '';
  try {
    const qs = new URLSearchParams({
      q: searchTerm,
      alt: altTerm
    });
    if (yummyId) qs.set('id', String(yummyId));
    if (slug) qs.set('slug', slug);

    const res = await fetch(apiUrl(`/api/yummy/episodes?${qs.toString()}`));
    const data = await res.json();
    if (data.episodes && data.episodes.length > 0) {
      let validEps = data.episodes.map(e => ({
        num: Number(e.num),
        title: `Episode ${e.num}`
      })).filter(e => !isNaN(e.num) && e.num > 0);

      if (validEps.length > 0) {
        validEps.sort((a, b) => a.num - b.num);
        episodesList.value = validEps;
        totalEpisodes.value = validEps.length;
      }
    }
  } catch (err) {
    console.warn('Backend episodes unreachable (mobile data / remote), fetching from Cloud direct...', err);
  }

  // Mobile data / offline backend fallback
  if (episodesList.value.length === 0) {
    try {
      const directEps = await fetchClientDirectEpisodes(searchTerm, altTerm, yummyId);
      if (directEps && directEps.length > 0) {
        episodesList.value = directEps;
        totalEpisodes.value = directEps.length;
      }
    } catch (_) {}
  }
}

// ---------------- Watch Initialization & Stream ----------------
async function initWatch() {
  const animeId = route.query.id;
  const ep = Number(route.query.ep) || 1;
  currentEpisode.value = ep;
  subtitleOffset.value = loadSavedSubtitleOffset(ep);

  if (!animeId) {
    router.push('/');
    return;
  }

  const queryTitle = route.query.title ? decodeURIComponent(route.query.title) : '';
  if (queryTitle) {
    anime.value = {
      id: animeId,
      title: { english: queryTitle, romaji: queryTitle },
      status: 'RELEASING'
    };
    computeEpisodeCount(anime.value);
    document.title = `${queryTitle} — Episode ${ep} | AniPulse Theater`;
    if (isAuthenticated.value) {
      loadEpisodeStream(ep);
    }
  }

  try {
    const details = await getAnimeDetails(animeId);
    
    // Safety guard against poisoned cache or Kitsu/AniList ID collisions
    const detEng = (details?.title?.english || '').toLowerCase();
    const detRom = (details?.title?.romaji || '').toLowerCase();
    const qLower = (queryTitle || '').toLowerCase();

    const isPoisoned = detEng.includes('himitsukessha') || detRom.includes('himitsukessha') ||
      detEng.includes('eagle talon') || detRom.includes('eagle talon') ||
      detEng.includes('schastlivyy') || detRom.includes('schastlivyy');

    if (isPoisoned) {
      console.warn('Blocked poisoned anime details from overwriting state:', details);
      if (!queryTitle) {
        anime.value = {
          id: animeId,
          title: { english: 'K-ON! Season 2', romaji: 'K-On!!' },
          status: 'FINISHED',
          episodes: 26
        };
      }
    } else {
      if (queryTitle && (qLower.includes('k-on') && !detEng.includes('k-on') && !detRom.includes('k-on'))) {
        console.warn('Anime details mismatch detected for queryTitle:', queryTitle, details);
        details.title = { english: queryTitle, romaji: queryTitle };
        details.episodes = 26;
      }
      anime.value = details;
    }

    originalSynopsis.value = stripHtml(anime.value.description || '');
    isFav.value = isFavorite(anime.value.id);

    const safeTitle = anime.value.title?.english || anime.value.title?.romaji || queryTitle || 'Anime';
    document.title = `${safeTitle} — Episode ${ep} | AniPulse Theater`;

    computeEpisodeCount(anime.value);
    saveHistory(anime.value, ep, 0, 0);

    fetchYummyEpisodes(anime.value);
    fetchArmMapping(anime.value.id);

    lookupTranslation(animeId).then(async (res) => {
      if (res.found && res.translation) {
        indonesianSynopsis.value = res.translation;
        isIndonesian.value = true;
        isServerCached.value = true;
      } else if (originalSynopsis.value) {
        try {
          const trRes = await translateSynopsis(originalSynopsis.value, animeId);
          if (trRes.translation) {
            indonesianSynopsis.value = trRes.translation;
            isIndonesian.value = true;
            isServerCached.value = true;
          }
        } catch (_) {}
      }
    });

    fetchKusonime(details);

    if (!queryTitle && isAuthenticated.value) {
      loadEpisodeStream(ep);
    } else if (!isAuthenticated.value) {
      isLoadingStream.value = false;
      showLoginModal.value = true;
    }

  } catch (err) {
    console.warn('initWatch notice:', err);
    if (!queryTitle && isAuthenticated.value) {
      loadEpisodeStream(ep);
    }
  }
}

async function loadEpisodeStream(ep) {
  if (!isAuthenticated.value) {
    isLoadingStream.value = false;
    showLoginModal.value = true;
    return;
  }

  stopKodikInterpolation();
  stopIframeTimePolling();
  isLoadingStream.value = true;
  showPlayOverlay.value = false;
  showResumeBanner.value = false;
  hasAutoSkippedThisEp.value = false;
  loadingMessage.value = `Menghubungkan ke server stream (Episode ${ep})...`;
  streamStatusText.value = `Menghubungkan ke server stream (Episode ${ep})...`;

  const queryTitle = route.query.title ? decodeURIComponent(route.query.title) : '';
  const title = anime.value?.title?.english || anime.value?.title?.romaji || queryTitle || '';
  const altTitle = anime.value?.title?.romaji || queryTitle || '';

  try {
    fetchSubtitles(title, altTitle, ep);

    const token = getAuthToken();
    const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
    const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const streamQs = new URLSearchParams({
      q: title,
      alt: altTitle,
      ep: String(ep)
    });
    if (anime.value?.yummyId) streamQs.set('id', String(anime.value.yummyId));
    if (anime.value?.slug) streamQs.set('slug', anime.value.slug);
    if (token) streamQs.set('token', token);

    let res = null;
    try {
      res = await fetch(apiUrl(`/api/yummy/streams?${streamQs.toString()}`), {
        headers: authHeaders,
        signal: controller.signal
      });
    } catch (netErr) {
      console.warn('Stream API fetch error (LAN/backend offline):', netErr.message);
    } finally {
      clearTimeout(timeoutId);
    }

    let dataSources = [];
    if (res && res.ok) {
      const data = await safeFetchJson(res, 'Stream Episode');
      if (data && Array.isArray(data.sources) && data.sources.length > 0) {
        dataSources = data.sources;
      }
    }

    if (dataSources.length === 0 && altTitle && altTitle !== title && res && res.ok) {
      try {
        const altRes = await fetch(apiUrl(`/api/yummy/streams?q=${encodeURIComponent(altTitle)}&ep=${ep}${tokenQuery}`), {
          headers: authHeaders
        });
        if (altRes.ok) {
          const altData = await safeFetchJson(altRes, 'Stream Episode Alt');
          if (altData && Array.isArray(altData.sources) && altData.sources.length > 0) {
            dataSources = altData.sources;
          }
        }
      } catch (_) {}
    }

    // Direct Cloud Stream Fallback (For Mobile Data / Kuota / Remote without LAN server, or to prioritize Audio Asli Jepang)
    if (dataSources.length === 0 || !dataSources.some(s => s.is_subtitles_original)) {
      console.log('Resolving direct Cloud Streams with Audio Asli Jepang...');
      const resolvedYummyId = anime.value?.yummyId || (Number(anime.value?.id || route.query.id) < 100000 ? Number(anime.value?.id || route.query.id) : null);
      const cloudSources = await fetchClientDirectStreams(title, altTitle, ep, resolvedYummyId, anime.value?.idMal, anime.value);
      if (cloudSources && cloudSources.length > 0) {
        const existingUrls = new Set(dataSources.map(s => s.player_url || s.iframe_url || ''));
        const newSources = cloudSources.filter(s => !existingUrls.has(s.player_url || s.iframe_url || ''));
        dataSources = [...newSources, ...dataSources];
      }
    }

    if (dataSources.length === 0) {
      currentSources.value = [];
      loadingMessage.value = `Stream belum tersedia untuk Episode ${ep}. Silakan pilih episode lain atau coba beberapa saat lagi.`;
      streamStatusText.value = 'Stream belum tersedia';
      isLoadingStream.value = false;
      return;
    }

    currentSources.value = dataSources;
    selectedSourceIndex.value = 0;

    const subIdx = dataSources.findIndex(s => s.is_subtitles_original);
    if (subIdx !== -1) {
      selectedSourceIndex.value = subIdx;
    }

    playSelectedSource();

  } catch (err) {
    console.warn('Stream load error:', err);
    currentSources.value = [];
    loadingMessage.value = `Gagal memuat stream Episode ${ep}: ${err.message}`;
    isLoadingStream.value = false;
  }
}

function playSelectedSource() {
  const source = currentSources.value[selectedSourceIndex.value];
  if (!source) {
    loadingMessage.value = 'Server stream tidak ditemukan.';
    isLoadingStream.value = false;
    return;
  }

  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  clearTimeout(safetyTimer);

  if (source.is_embed || source.iframe_url) {
    isCurrentSourceEmbed.value = true;
    currentEmbedUrl.value = source.iframe_url || source.player_url;
    streamStatusText.value = `Memutar: ${source.title} (Cloud Direct)`;
    isLoadingStream.value = false;
    availableVideos.value = source.videos || [{ quality: 720, type: 'embed' }];
    return;
  }

  isCurrentSourceEmbed.value = false;
  currentEmbedUrl.value = '';

  if (!source.videos || source.videos.length === 0) {
    loadingMessage.value = 'Video tidak tersedia untuk server ini.';
    isLoadingStream.value = false;
    return;
  }

  availableVideos.value = source.videos;

  let video = source.videos.find(v => Number(v.quality) === selectedQuality.value);
  if (!video) {
    video = source.videos[0];
    selectedQuality.value = Number(video.quality);
  }

  // Destroy previous HLS instance if any
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  clearTimeout(safetyTimer);

  const videoEl = videoRef.value;
  if (!videoEl) return;

  // Non-blocking safety timer: dismiss overlay within 3.5s
  safetyTimer = setTimeout(() => {
    isLoadingStream.value = false;
  }, 3500);

  const isHls = video.type === 'm3u8' || 
                (video.url && (video.url.includes('.m3u8') || video.url.includes('/api/hls/manifest'))) || 
                (video.direct_url && video.direct_url.includes('.m3u8'));
  const isMp4 = !isHls && (video.type === 'mp4' || (video.direct_url && video.direct_url.toLowerCase().endsWith('.mp4')));

  if (isMp4) {
    streamStatusText.value = `Memutar: ${source.title} (${video.quality}p MP4)`;
    const playUrl = apiUrl(video.url) || video.direct_url;

    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.src = playUrl;
    videoEl.load();

    const onCanPlay = () => {
      isLoadingStream.value = false;
      checkResumeProgress();
      videoEl.play().catch(e => {
        console.log('Autoplay deferred by browser:', e);
        showPlayOverlay.value = true;
      });
      videoEl.removeEventListener('canplay', onCanPlay);
    };
    videoEl.addEventListener('canplay', onCanPlay);

    const onError = () => {
      console.warn('MP4 playback error, trying alternate stream URL...');
      const altUrl = (video.direct_url && videoEl.src.includes(video.direct_url)) ? (video.url ? apiUrl(video.url) : null) : video.direct_url;
      if (altUrl && videoEl.src !== altUrl) {
        videoEl.src = altUrl;
        videoEl.load();
        videoEl.play().catch(e => {
          showPlayOverlay.value = true;
        });
      }
      videoEl.removeEventListener('error', onError);
    };
    videoEl.addEventListener('error', onError);
    return;
  }

  streamStatusText.value = `Memutar: ${source.title} (${video.quality}p HLS)`;
  const directHlsUrl = video.direct_url || '';
  const proxyHlsUrl = video.url ? apiUrl(video.url) : '';
  // On mobile native app (Capacitor https://localhost), direct HTTPS stream prevents mixed content and doesn't depend on LAN server
  let currentHlsUrl = (isMobileNativeApp() && directHlsUrl) ? directHlsUrl : (proxyHlsUrl || directHlsUrl);

  if (Hls.isSupported()) {
    hlsInstance = new Hls({
      maxBufferLength: 90,
      maxMaxBufferLength: 300,
      maxBufferSize: 120 * 1024 * 1024,
      maxBufferHole: 1.5,
      startFragPrefetch: true,
      progressive: true,
      lowLatencyMode: false,
      backBufferLength: 90,
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

    hlsInstance.loadSource(currentHlsUrl);
    hlsInstance.attachMedia(videoEl);

    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      isLoadingStream.value = false;
      checkResumeProgress();
      videoEl.play().catch(e => {
        console.log('Autoplay deferred by browser:', e);
        showPlayOverlay.value = true;
      });
    });

    hlsInstance.on(Hls.Events.LEVEL_LOADED, () => {
      isLoadingStream.value = false;
    });

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // Failover between direct CDN URL and backend proxy
            if (proxyHlsUrl && currentHlsUrl !== proxyHlsUrl) {
              console.log('HLS Network failover to proxy URL:', proxyHlsUrl);
              currentHlsUrl = proxyHlsUrl;
              hlsInstance.loadSource(proxyHlsUrl);
              hlsInstance.startLoad();
              return;
            } else if (directHlsUrl && currentHlsUrl !== directHlsUrl) {
              console.log('HLS Network failover to direct URL:', directHlsUrl);
              currentHlsUrl = directHlsUrl;
              hlsInstance.loadSource(directHlsUrl);
              hlsInstance.startLoad();
              return;
            }
            hlsInstance.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hlsInstance.recoverMediaError();
            break;
          default:
            hlsInstance.destroy();
            break;
        }
      }
    });
  } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari / WebKit native HLS
    videoEl.src = currentHlsUrl;
    videoEl.onloadedmetadata = () => {
      isLoadingStream.value = false;
      checkResumeProgress();
      videoEl.play().catch(e => {
        showPlayOverlay.value = true;
      });
    };
  }
}

function startManualPlayback() {
  showPlayOverlay.value = false;
  if (videoRef.value) {
    videoRef.value.play().catch(e => console.log('Play error:', e));
  }
}

function onVideoPlay() {
  isLoadingStream.value = false;
  showPlayOverlay.value = false;
  cancelAnimationFrame(rafSubId);
  rafSubId = requestAnimationFrame(syncSubtitleLoop);
}

function onVideoPlaying() {
  isLoadingStream.value = false;
  showPlayOverlay.value = false;
  cancelAnimationFrame(rafSubId);
  rafSubId = requestAnimationFrame(syncSubtitleLoop);
}

function onVideoCanPlay() {
  isLoadingStream.value = false;
}

function switchSource(idx) {
  selectedSourceIndex.value = idx;
  playSelectedSource();
}

function switchQuality(q) {
  selectedQuality.value = q;
  playSelectedSource();
}

function switchEpisode(epNum) {
  if (!isAuthenticated.value) {
    showLoginModal.value = true;
    return;
  }
  if (currentEpisode.value === epNum) return;

  // Save current episode progress
  const videoEl = videoRef.value;
  if (anime.value && videoEl && videoEl.currentTime > 2 && videoEl.duration > 0) {
    updateWatchProgress(anime.value.id, currentEpisode.value, videoEl.currentTime, videoEl.duration);
  }

  currentEpisode.value = epNum;
  lastSavedTime.value = 0;
  showResumeBanner.value = false;
  hasAutoSkippedThisEp.value = false;

  // Load saved offset for new episode or default to 0.0s (exact audio sync)
  subtitleOffset.value = loadSavedSubtitleOffset(epNum);

  // Keep chunk tab in sync
  if (totalEpisodes.value > 25) {
    const idx = Math.floor((epNum - 1) / 25);
    if (idx >= 0 && idx < episodeChunks.value.length) {
      currentChunkIndex.value = idx;
    }
  }

  // Update URL without full refresh
  router.replace({ query: { ...route.query, ep: epNum } });
  document.title = `${anime.value?.title?.english || anime.value?.title?.romaji} — Episode ${epNum} | AniPulse Theater`;

  // Save entry for new episode
  saveHistory(anime.value, epNum, 0, 0);

  // Load stream for new episode
  loadEpisodeStream(epNum);
}

// ---------------- Subtitle Synchronization (60 FPS & Directional Calibration) ----------------
function loadSavedSubtitleOffset(epNum) {
  try {
    // Clean up old inaccurate +2.1s offset from previous versions
    const oldKey = `anipulse_sub_offset_${epNum}`;
    const oldVal = localStorage.getItem(oldKey);
    if (oldVal !== null) {
      const parsedOld = parseFloat(oldVal);
      if (Math.abs(parsedOld - 2.1) < 0.05) {
        localStorage.removeItem(oldKey);
      }
    }
    const saved = localStorage.getItem(`anipulse_sub_offset_v3_${epNum}`);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && isFinite(parsed)) {
        return parsed;
      }
    }
  } catch (e) {}
  return 0.0;
}

function updateCurrentCueFromTime(cur) {
  if (activeSubtitleCues.value.length === 0) {
    currentSubtitleCueText.value = '';
    return;
  }
  const effectiveTime = cur + subtitleOffset.value;
  // Match cue with slight 0.15s anticipation tolerance and hold window for zero-lag instant overlay
  const cue = activeSubtitleCues.value.find(c => (effectiveTime + 0.15) >= c.start && effectiveTime <= (c.end + 0.25));
  currentSubtitleCueText.value = cue ? cue.text : '';
}

function updateCurrentCue() {
  if (isCurrentSourceEmbed.value) {
    updateCurrentCueFromTime(watchCurrentTime.value || 0);
    return;
  }
  const videoEl = videoRef.value;
  if (!videoEl || activeSubtitleCues.value.length === 0) {
    currentSubtitleCueText.value = '';
    return;
  }
  const cur = videoEl.currentTime || 0;
  updateCurrentCueFromTime(cur);
}

// Kodik Iframe postMessage & 60 FPS clock interpolation for zero-lag Subtitle Timpa
let iframePollInterval = null;
let kodikBaseTime = 0;
let kodikBasePerfTime = 0;
let isKodikPlaying = false;
let kodikRafId = null;

function kodikInterpolationLoop() {
  if (isKodikPlaying && isCurrentSourceEmbed.value) {
    const elapsed = (performance.now() - kodikBasePerfTime) / 1000;
    const cur = kodikBaseTime + elapsed;
    watchCurrentTime.value = cur;
    updateCurrentCueFromTime(cur);
    kodikRafId = requestAnimationFrame(kodikInterpolationLoop);
  }
}

function startKodikInterpolation(baseTime) {
  kodikBaseTime = baseTime;
  kodikBasePerfTime = performance.now();
  isKodikPlaying = true;
  if (kodikRafId) cancelAnimationFrame(kodikRafId);
  kodikRafId = requestAnimationFrame(kodikInterpolationLoop);
}

function stopKodikInterpolation() {
  isKodikPlaying = false;
  if (kodikRafId) {
    cancelAnimationFrame(kodikRafId);
    kodikRafId = null;
  }
}

function requestKodikCurrentTime() {
  const iframe = document.querySelector('.embed-cloud-frame');
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.postMessage({ key: 'kodik_player_api', value: { method: 'get_time' } }, '*');
    } catch (_) {}
  }
}

function startIframeTimePolling() {
  if (iframePollInterval) clearInterval(iframePollInterval);
  iframePollInterval = setInterval(() => {
    requestKodikCurrentTime();
  }, 250);
}

function stopIframeTimePolling() {
  if (iframePollInterval) {
    clearInterval(iframePollInterval);
    iframePollInterval = null;
  }
}

function onKodikPlayerMessage(event) {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.key === 'kodik_player_time' || data.key === 'kodik_player_time_update') {
    const rawVal = data.value;
    const timeSec = typeof rawVal === 'number' ? rawVal : (rawVal?.time || rawVal?.currentTime || 0);
    if (!isNaN(timeSec) && isFinite(timeSec)) {
      watchCurrentTime.value = timeSec;
      startKodikInterpolation(timeSec);
      updateCurrentCueFromTime(timeSec);
    }
  } else if (data.key === 'kodik_player_duration_update') {
    const dur = Number(data.value);
    if (!isNaN(dur) && dur > 0) watchDuration.value = dur;
  } else if (data.key === 'kodik_player_play' || data.key === 'video_started' || data.key === 'kodik_player_video_started') {
    startKodikInterpolation(watchCurrentTime.value || 0);
    startIframeTimePolling();
  } else if (data.key === 'kodik_player_pause' || data.key === 'kodik_player_video_ended') {
    stopKodikInterpolation();
    stopIframeTimePolling();
  } else if (data.key === 'kodik_player_fullscreen_change' || data.action === 'fullscreen') {
    const isFs = typeof data.value === 'boolean' ? data.value : !!data.value;
    if (isFs && !isTheaterFullscreen.value) {
      toggleTheaterFullscreen();
    } else if (!isFs && isTheaterFullscreen.value) {
      toggleTheaterFullscreen();
    }
  }
}

function syncSubtitleLoop() {
  const videoEl = videoRef.value;
  if (videoEl && !videoEl.paused) {
    updateCurrentCue();
    rafSubId = requestAnimationFrame(syncSubtitleLoop);
  }
}

function adjustSubtitleOffset(delta) {
  subtitleOffset.value = Math.round((subtitleOffset.value + delta) * 10) / 10;
  try {
    localStorage.setItem(`anipulse_sub_offset_v3_${currentEpisode.value}`, subtitleOffset.value.toString());
  } catch (e) {}
  updateCurrentCue();
}

function resetSubtitleOffset() {
  subtitleOffset.value = 0.0;
  try {
    localStorage.setItem(`anipulse_sub_offset_v3_${currentEpisode.value}`, '0.0');
    localStorage.removeItem(`anipulse_sub_offset_${currentEpisode.value}`);
  } catch (e) {}
  updateCurrentCue();
}

// ---------------- Video Event Handlers ----------------
function onTimeUpdate() {
  const videoEl = videoRef.value;
  if (!videoEl) return;

  const cur = videoEl.currentTime || 0;
  const dur = (videoEl.duration && !isNaN(videoEl.duration) && isFinite(videoEl.duration)) ? videoEl.duration : 0;
  watchCurrentTime.value = cur;
  if (dur > 0) watchDuration.value = dur;

  // Real-time cue update (supplemented by 60 FPS requestAnimationFrame loop during playback)
  updateCurrentCue();

  // Auto-skip opening if enabled and during intro (1s - 6s)
  if (autoSkipOp.value && !hasAutoSkippedThisEp.value && cur >= 1 && cur <= 6) {
    hasAutoSkippedThisEp.value = true;
    skipOpening(true);
  }

  // Calculate buffer ahead
  let buffered = 0;
  for (let i = 0; i < videoEl.buffered.length; i++) {
    if (videoEl.buffered.start(i) <= cur && cur <= videoEl.buffered.end(i)) {
      buffered = Math.round(videoEl.buffered.end(i) - cur);
      break;
    }
  }
  bufferAheadSec.value = buffered;
  isBufferingStable.value = buffered >= 10;

  // Save progress every 3 seconds or on seek
  if (Math.abs(cur - lastSavedTime.value) >= 3) {
    lastSavedTime.value = cur;
    if (anime.value) {
      updateWatchProgress(anime.value.id, currentEpisode.value, cur, dur);
    }
  }
}

function onVideoPause() {
  cancelAnimationFrame(rafSubId);
  const videoEl = videoRef.value;
  if (anime.value && videoEl && videoEl.duration > 0 && videoEl.currentTime > 2) {
    updateWatchProgress(anime.value.id, currentEpisode.value, videoEl.currentTime, videoEl.duration);
  }
}

function onVideoSeeked() {
  updateCurrentCue();
  const videoEl = videoRef.value;
  if (anime.value && videoEl && videoEl.duration > 0) {
    updateWatchProgress(anime.value.id, currentEpisode.value, videoEl.currentTime, videoEl.duration);
  }
}

function onVideoEnded() {
  if (autoNext.value && currentEpisode.value < totalEpisodes.value) {
    switchEpisode(currentEpisode.value + 1);
  }
}

// ---------------- Resume Progress ----------------
function checkResumeProgress() {
  if (!anime.value) return;
  const saved = getEpisodeProgress(anime.value.id, currentEpisode.value);
  if (saved && saved.currentTime > 5 && (!saved.duration || saved.currentTime < (saved.duration - 15))) {
    savedResumeTime.value = saved.currentTime;
    showResumeBanner.value = true;
    setTimeout(() => {
      showResumeBanner.value = false;
    }, 12000);
  } else {
    savedResumeTime.value = 0;
    showResumeBanner.value = false;
  }
}

function applyResume(resume) {
  showResumeBanner.value = false;
  const videoEl = videoRef.value;
  if (!videoEl) return;

  if (resume && savedResumeTime.value > 0) {
    videoEl.currentTime = savedResumeTime.value;
    videoEl.play().catch(() => {});
  } else {
    videoEl.currentTime = 0;
    videoEl.play().catch(() => {});
    if (anime.value) {
      updateWatchProgress(anime.value.id, currentEpisode.value, 0, videoEl.duration || 0);
    }
  }
}

// ---------------- Subtitles ----------------
async function fetchSubtitles(title, altTitle, ep) {
  isSearchingSubtitles.value = true;
  try {
    // 1. Prioritize pre-cached offline Indonesian subtitles
    const presetSubs = getPresetSubtitles(title, altTitle, ep);
    if (presetSubs && presetSubs.length > 0) {
      subtitlesList.value = presetSubs;
      const idIdx = presetSubs.findIndex(s => s.lang === 'id' || s.label?.toLowerCase().includes('indo'));
      if (idIdx !== -1) {
        selectedSubIndex.value = idIdx;
        applySubtitleTrack(presetSubs[idIdx]);
      }
      return;
    }

    const res = await fetch(apiUrl(`/api/subtitles/search?title=${encodeURIComponent(title)}&alt_title=${encodeURIComponent(altTitle)}&ep=${ep}`));
    const data = await res.json();
    if (data.subtitles && data.subtitles.length > 0) {
      subtitlesList.value = data.subtitles;
      // Default to Indonesian if found
      const idIdx = data.subtitles.findIndex(s => s.lang === 'id' || s.label?.toLowerCase().includes('indo'));
      if (idIdx !== -1) {
        selectedSubIndex.value = idIdx;
        applySubtitleTrack(data.subtitles[idIdx]);
      }
    }
  } catch (err) {
    console.warn('Subtitles search error:', err);
  } finally {
    isSearchingSubtitles.value = false;
  }
}

function switchSubtitle(idx) {
  selectedSubIndex.value = idx;
  if (idx === -1) {
    applySubtitleTrack(null);
  } else {
    applySubtitleTrack(subtitlesList.value[idx]);
  }
}

function parseVttToCues(vttText) {
  if (!vttText) return [];
  const lines = vttText.split(/\r?\n/);
  const cues = [];
  let i = 0;

  function parseTimestamp(ts) {
    if (!ts) return 0;
    const parts = ts.trim().split(':');
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return 0;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->');
      const start = parseTimestamp(startStr.trim().split(' ')[0]);
      const end = parseTimestamp(endStr.trim().split(' ')[0]);
      i++;
      const textLines = [];
      while (i < lines.length && lines[i].trim() !== '') {
        const tLine = lines[i].trim();
        // Skip cue metadata or formatting tags if any
        if (!tLine.startsWith('NOTE') && !tLine.startsWith('STYLE')) {
          textLines.push(tLine.replace(/<[^>]+>/g, ''));
        }
        i++;
      }
      if (textLines.length > 0 && end > start) {
        cues.push({
          start,
          end,
          text: textLines.join('<br>')
        });
      }
    } else {
      i++;
    }
  }
  return cues;
}

async function applySubtitleTrack(sub) {
  activeSubtitleCues.value = [];
  currentSubtitleCueText.value = '';

  if (!sub) return;

  // 1. Fetch / load & parse VTT for the high-contrast cinema overlay (works for both iframe & native video!)
  try {
    if (sub.vtt_content) {
      activeSubtitleCues.value = parseVttToCues(sub.vtt_content);
    } else if (sub.vtt_url) {
      const res = await fetch(apiUrl(sub.vtt_url));
      if (res.ok) {
        const vtt = await res.text();
        activeSubtitleCues.value = parseVttToCues(vtt);
      }
    }
    updateCurrentCue();
  } catch (err) {
    console.warn('Failed to parse subtitle overlay cues:', err);
  }

  // 2. Native HTML5 track attach (only when native video element is active)
  const videoEl = videoRef.value;
  if (!videoEl) return;

  const tracks = videoEl.querySelectorAll('track');
  tracks.forEach(t => t.remove());

  try {
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = sub.label;
    track.srclang = sub.lang;
    track.src = sub.vtt_url ? apiUrl(sub.vtt_url) : '';
    track.default = false;

    const syncTrackMode = () => {
      // If custom Cinema Subtitle Overlay has cues, keep native track hidden to avoid double subtitles
      const desiredMode = (activeSubtitleCues.value && activeSubtitleCues.value.length > 0) ? 'hidden' : 'showing';
      if (track.track) track.track.mode = desiredMode;
      if (videoEl.textTracks) {
        for (let i = 0; i < videoEl.textTracks.length; i++) {
          videoEl.textTracks[i].mode = desiredMode;
        }
      }
    };

    track.addEventListener('load', syncTrackMode);
    videoEl.appendChild(track);
    syncTrackMode();
  } catch (e) {
    // ignore
  }
}

// ---------------- ARM & Kusonime & Translation ----------------
async function fetchArmMapping(id) {
  try {
    const res = await fetch(apiUrl(`/api/arm/lookup?id=${id}`));
    const data = await res.json();
    if (!data.error) {
      armMapping.value = data;
    }
  } catch (_) {
    armMapping.value = null;
  }
}

async function fetchKusonime(details) {
  kusonimeDownloads.value = [];
  const title = details.title?.romaji || details.title?.english;
  if (!title) return;
  try {
    const res = await searchKusonime(title, 2);
    if (res && res.length > 0 && res[0].link) {
      const dlRes = await getKusonimeDownloads(res[0].link);
      if (dlRes && dlRes.downloads) {
        kusonimeDownloads.value = dlRes.downloads;
      }
    }
  } catch (_) {}
}

async function toggleTranslate() {
  if (isIndonesian.value) {
    isIndonesian.value = false;
    return;
  }

  if (indonesianSynopsis.value) {
    isIndonesian.value = true;
    return;
  }

  isTranslating.value = true;
  try {
    const res = await translateSynopsis(originalSynopsis.value, anime.value.id);
    if (res.success && res.translation) {
      indonesianSynopsis.value = res.translation;
      isIndonesian.value = true;
      isServerCached.value = true;
    }
  } catch (err) {
    console.error('Translation error:', err);
  } finally {
    isTranslating.value = false;
  }
}

function handleToggleFavorite() {
  if (!anime.value) return;
  isFav.value = toggleFavorite(anime.value);
}

function navigateToAnime(id) {
  router.push(`/watch?id=${id}&ep=1`);
}

// ---------------- Keyboard Shortcuts ----------------
function handleKeydown(e) {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  const videoEl = videoRef.value;
  if (!videoEl) return;

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
      toggleTheaterFullscreen();
      break;
    case 'Escape':
      if (isTheaterFullscreen.value) {
        e.preventDefault();
        toggleTheaterFullscreen();
      }
      break;
    case 'KeyM':
      e.preventDefault();
      videoEl.muted = !videoEl.muted;
      break;
  }
}

watch(isAuthenticated, (isAuth) => {
  if (isAuth && anime.value) {
    loadEpisodeStream(currentEpisode.value);
  } else if (!isAuth) {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    const videoEl = videoRef.value;
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    }
  }
});

watch(() => route.query.ep, (newEp) => {
  if (newEp && Number(newEp) !== currentEpisode.value) {
    currentEpisode.value = Number(newEp);
    loadEpisodeStream(currentEpisode.value);
  }
});

watch(() => route.query.id, (newId) => {
  if (newId && anime.value && Number(newId) !== Number(anime.value.id)) {
    initWatch();
  }
});

onMounted(() => {
  // Evict any poisoned cache entries from localStorage (e.g. Himitsukessha / Eagle Talon / Schastlivyy)
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('anipulse_anime_detail_') || k.startsWith('anipulse_history') || k.startsWith('anipulse_fav'))) {
        const val = localStorage.getItem(k);
        if (val && (val.includes('himitsukessha') || val.includes('Himitsukessha') || val.includes('Eagle Talon') || val.includes('Schastlivyy'))) {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (_) {}

  initWatch();
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('message', onKodikPlayerMessage);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('message', onKodikPlayerMessage);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
  stopIframeTimePolling();
  stopKodikInterpolation();
  clearTimeout(safetyTimer);
  if (rafSubId) {
    cancelAnimationFrame(rafSubId);
  }
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
});
</script>

<style scoped>
.watch-page-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 4rem;
}

.theater-main {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  min-width: 0;
}

/* Breadcrumb */
.theater-breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bc-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.15s ease;
}

.bc-link:hover {
  color: #fff;
}

.bc-anime-title {
  color: #cbd5e1;
}

/* Player Viewport */
.theater-player-box {
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85);
  border: 1px solid #1e2230;
  aspect-ratio: 16 / 9;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.native-hls-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  display: block;
}

.embed-cloud-frame {
  border: 0;
  width: 100%;
  height: 100%;
  background: #000;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
}

/* Suppress native browser cue to prevent double subtitles */
.native-hls-player::cue,
video::cue {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  background: transparent !important;
  color: transparent !important;
  font-size: 0 !important;
  line-height: 0 !important;
}

/* Floating Skip Opening Button */
.skip-op-overlay-btn {
  position: absolute;
  bottom: 4.5rem;
  right: 1.5rem;
  background: rgba(18, 20, 28, 0.92);
  border: 1px solid #ff4d2e;
  color: #fff;
  font-size: 0.88rem;
  font-weight: 700;
  padding: 0.55rem 1.15rem;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  backdrop-filter: blur(12px);
  box-shadow: 0 6px 22px rgba(255, 77, 46, 0.45);
  z-index: 30;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}

.skip-op-overlay-btn:hover {
  background: #ff4d2e;
  transform: scale(1.05);
  box-shadow: 0 8px 28px rgba(255, 77, 46, 0.65);
}

.player-action-toast {
  position: absolute;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(12, 14, 20, 0.95);
  border: 1px solid #ff4d2e;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 0.5rem 1.25rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  z-index: 35;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  pointer-events: none;
}

.player-loader {
  position: absolute;
  inset: 0;
  background: rgba(8, 9, 12, 0.88);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 20;
  color: #fff;
  pointer-events: none;
}

.manual-play-overlay {
  position: absolute;
  inset: 0;
  background: rgba(8, 9, 12, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  z-index: 25;
  cursor: pointer;
  transition: background 0.2s;
}

.manual-play-overlay:hover {
  background: rgba(8, 9, 12, 0.85);
}

.manual-play-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #ff4d2e;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 30px rgba(255, 77, 46, 0.6);
  padding-left: 5px;
  transition: transform 0.2s;
}

.manual-play-overlay:hover .manual-play-icon {
  transform: scale(1.1);
}

.manual-play-text {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
}

/* Resume Prompt Banner */
.watch-resume-banner {
  position: absolute;
  bottom: 4.5rem;
  left: 1.5rem;
  background: rgba(18, 20, 28, 0.95);
  border: 1px solid #ff4d2e;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  z-index: 30;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  animation: slideUp 0.25s ease;
}

.resume-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #fff;
}

.resume-subtitle {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.1rem;
}

/* VIP Locked Theater Overlay */
.vip-locked-theater-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(20, 10, 15, 0.96) 0%, rgba(6, 7, 10, 0.99) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
  padding: 1.5rem;
  text-align: center;
  backdrop-filter: blur(16px);
}

.vip-locked-backdrop-glow {
  display: none;
}

.vip-locked-card {
  position: relative;
  z-index: 2;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
}

.vip-locked-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: rgba(229, 9, 20, 0.12);
  border: 1px solid rgba(229, 9, 20, 0.3);
  color: #ef4444;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  text-transform: uppercase;
}

.vip-locked-title {
  font-size: 1.55rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.02em;
  margin: 0;
}

.vip-locked-desc {
  font-size: 0.9rem;
  color: #94a3b8;
  line-height: 1.55;
  margin: 0;
}

.vip-locked-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  flex-wrap: wrap;
  margin-top: 0.4rem;
}

.vip-btn-glow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #e50914;
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 0.65rem 1.3rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s;
}

.vip-btn-glow:hover {
  background: #b91c1c;
}

.vip-btn-invite {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(234, 179, 8, 0.4);
  color: #fbbf24;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 0.65rem 1.3rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.vip-btn-invite:hover {
  background: rgba(234, 179, 8, 0.18);
  border-color: #fbbf24;
  transform: translateY(-2px);
}

.vip-locked-footer-hint {
  font-size: 0.76rem;
  color: #64748b;
  margin-top: 0.4rem;
}


.resume-banner-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.resume-close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 0.9rem;
  padding: 0.2rem 0.4rem;
  cursor: pointer;
}

/* Episode Title & Total Count Row (Miru style) */
.theater-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.episode-heading {
  font-size: 1.65rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.02em;
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  margin: 0;
}

.total-ep-accent {
  font-size: 1.15rem;
  font-weight: 800;
  color: #ff4d2e;
}

.title-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-skip-pill {
  background: rgba(255, 77, 46, 0.12);
  border: 1px solid rgba(255, 77, 46, 0.35);
  color: #ff4d2e;
  padding: 0.45rem 0.95rem;
  border-radius: 9999px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
  transition: all 0.2s ease;
}

.btn-skip-pill:hover {
  background: #ff4d2e;
  color: #fff;
  border-color: #ff4d2e;
}

.btn-fav-pill {
  background: #18181c;
  border: 1px solid #2a2e3d;
  color: #cbd5e1;
  padding: 0.45rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
  transition: all 0.2s ease;
}

.btn-fav-pill:hover, .btn-fav-pill.is-saved {
  background: rgba(255, 77, 46, 0.15);
  border-color: #ff4d2e;
  color: #fff;
}

/* Versi (Server / Audio Dub) Container (Matches Miru screenshot) */
.theater-version-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.85rem;
}

.version-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.version-label {
  font-size: 0.82rem;
  color: #94a3b8;
  font-weight: 600;
}

.version-select-box {
  position: relative;
  background: #18181c;
  border: 1px solid #2a2e3d;
  border-radius: 8px;
  transition: border-color 0.15s ease;
}

.version-select-box:hover, .version-select-box:focus-within {
  border-color: #ff4d2e;
}

.version-native-select {
  width: 100%;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 0.86rem;
  font-weight: 600;
  padding: 0.65rem 2rem 0.65rem 0.85rem;
  appearance: none;
  -webkit-appearance: none;
  outline: none;
  cursor: pointer;
}

.version-native-select option {
  background: #12141c;
  color: #fff;
}

.version-chevron {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
  display: flex;
  align-items: center;
}

/* Subtitle Sync Offset Controls */
.sync-offset-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  background: #2a2e3d;
  color: #94a3b8;
  font-size: 0.72rem;
  border-radius: 4px;
  font-weight: 700;
  font-family: monospace;
}

.sync-offset-badge.is-shifted {
  background: rgba(255, 77, 46, 0.2);
  color: #ff4d2e;
  border: 1px solid rgba(255, 77, 46, 0.4);
}

.sub-sync-btn-group {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #18181c;
  border: 1px solid #2a2e3d;
  border-radius: 8px;
  padding: 4px;
}

.btn-sync-step {
  flex: 1;
  background: transparent;
  border: none;
  color: #cbd5e1;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.45rem 0.2rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}

.btn-sync-step:hover {
  background: #2a2e3d;
  color: #fff;
}

.btn-sync-reset {
  color: #ff4d2e;
  font-size: 0.75rem;
}

.btn-sync-faster {
  color: #34d399;
}

.btn-sync-slower {
  color: #94a3b8;
}

/* Episode Picker Cards Grid (Miru buttons: 1, 2, 3...) */
.theater-episodes-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ep-chunk-tabs {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.chunk-tab-btn {
  background: #18181c;
  border: 1px solid #2a2e3d;
  color: #94a3b8;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.chunk-tab-btn.active {
  background: rgba(255, 77, 46, 0.2);
  border-color: #ff4d2e;
  color: #fff;
}

.theater-ep-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 0.6rem;
}

.ep-card-btn {
  height: 52px;
  background: #18181c;
  border: 1px solid #2a2e3d;
  border-radius: 8px;
  color: #fff;
  font-size: 1.15rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  user-select: none;
}

.ep-card-btn:hover {
  background: #242938;
  border-color: #3b4257;
  transform: translateY(-1px);
}

.ep-card-btn.active {
  background: #ff4d2e !important;
  border-color: #ff4d2e !important;
  color: #fff !important;
  box-shadow: 0 4px 16px rgba(255, 77, 46, 0.45);
}

/* Ep Nav Toolbar */
.ep-nav-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  background: #12141c;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #1e2230;
}

.ep-nav-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  padding: 0.45rem 0.85rem;
}

.player-switches-group {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.auto-switch-label {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.8rem;
  color: #94a3b8;
  cursor: pointer;
  user-select: none;
}

/* Stream Notice Row */
.stream-notice-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.2rem;
}

.player-server-notice {
  font-size: 0.82rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-m3u8 {
  font-size: 0.72rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.watch-progress-badge {
  font-size: 0.78rem;
  color: #94a3b8;
  background: #181b26;
  border: 1px solid #2a3044;
  padding: 0.25rem 0.65rem;
  border-radius: 4px;
}

.buffer-text {
  color: #10b981;
}

/* Cache Line Visual Bar */
.cache-line-container {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  background: #0f121a;
  border: 1px solid #1e2433;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  margin-top: 0.35rem;
}

.cache-line-track {
  position: relative;
  width: 100%;
  height: 6px;
  background: #1e2438;
  border-radius: 999px;
  overflow: hidden;
}

.cache-line-playhead {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: #ff4d2e;
  border-radius: 999px;
  transition: width 0.25s linear;
  z-index: 2;
}

.cache-line-buffer {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(16, 185, 129, 0.55);
  border-radius: 999px;
  transition: width 0.3s ease, left 0.25s linear;
  z-index: 1;
}

.cache-line-labels {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.72rem;
  color: #94a3b8;
}

.cache-label-left {
  font-weight: 500;
  color: #64748b;
}

.cache-label-right {
  font-weight: 600;
}

/* Info Card */
.watch-info-card {
  background: #12141c;
  border: 1px solid #1e2230;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.watch-info-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.anime-main-title {
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1.25;
}

.anime-alt-title {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-top: 0.2rem;
}

.watch-badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.badge-tag {
  display: inline-flex;
  align-items: center;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  background: #181b26;
  border: 1px solid #2a3044;
  color: #cbd5e1;
}

.badge-score {
  background: #eab308;
  color: #000;
  font-weight: 800;
  border-color: #eab308;
}

.badge-ongoing {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.35);
}

.badge-ep-count {
  background: rgba(255, 77, 46, 0.12);
  color: #ff6b72;
  border-color: rgba(255, 77, 46, 0.3);
  font-weight: 700;
}

.dashboard-genre-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.genre-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #94a3b8;
}

.genre-pill {
  background: #181b26;
  border: 1px solid #2a3044;
  color: #cbd5e1;
  font-size: 0.76rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  text-decoration: none;
  transition: all 0.15s;
}

.genre-pill:hover {
  background: #ff4d2e;
  color: #fff;
  border-color: #ff4d2e;
}

.watch-arm-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.arm-tag {
  background: #181b26;
  border: 1px solid #2a3044;
  color: #94a3b8;
  font-size: 0.72rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

/* Synopsis */
.synopsis-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.synopsis-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.synopsis-heading {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
}

.synopsis-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cached-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: #10b981;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.btn-translate {
  font-size: 0.75rem;
  padding: 0.25rem 0.65rem;
}

.synopsis-box {
  background: #181b26;
  border: 1px solid #1e2230;
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.88rem;
  line-height: 1.6;
  color: #cbd5e1;
}

/* Batch Downloads */
.batch-downloads-section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.section-subheading {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
}

.downloads-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.download-box {
  background: #181b26;
  border: 1px solid #2a3044;
  border-radius: 6px;
  padding: 0.65rem 0.85rem;
}

.download-quality-title {
  font-weight: 700;
  color: #fff;
  font-size: 0.8rem;
  margin-bottom: 0.35rem;
}

.download-links-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.legal-badge {
  background: #12141c;
  border: 1px solid #2a3044;
  color: #cbd5e1;
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  text-decoration: none;
  transition: all 0.15s;
}

.legal-badge:hover {
  background: #ff4d2e;
  color: #fff;
  border-color: #ff4d2e;
}

/* Recs Grid */
.recs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 0.85rem;
  margin-top: 0.5rem;
}

.rec-card {
  cursor: pointer;
  text-decoration: none;
}

.rec-poster-box {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #2a3044;
  background: #181b26;
}

.rec-poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.25s;
}

.rec-card:hover .rec-poster {
  transform: scale(1.05);
}

.rec-score-badge {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  background: rgba(0, 0, 0, 0.75);
  color: #eab308;
  font-weight: 800;
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  backdrop-filter: blur(4px);
}

.rec-title {
  font-size: 0.8rem;
  line-height: 1.25;
  color: #fff;
  margin-top: 0.45rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #ff4d2e;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

.spinner-tiny {
  width: 11px;
  height: 11px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.15); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Animations for Skip Opening */
.fade-scale-enter-active, .fade-scale-leave-active {
  transition: all 0.2s ease;
}
.fade-scale-enter-from, .fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.toast-slide-enter-active, .toast-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-slide-enter-from, .toast-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -12px);
}

/* Mobile Responsiveness matching the native Miru screenshot */
@media (max-width: 768px) {
  .watch-page-container {
    padding: 0 0 3.5rem 0;
  }

  .theater-main {
    gap: 0.85rem;
  }

  .theater-breadcrumb-bar {
    padding: 0.65rem 0.85rem 0.15rem 0.85rem;
  }

  .theater-player-box {
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .skip-op-overlay-btn {
    bottom: 3.5rem;
    right: 0.75rem;
    font-size: 0.78rem;
    padding: 0.45rem 0.85rem;
  }

  .theater-title-row {
    padding: 0 0.85rem;
  }

  .episode-heading {
    font-size: 1.45rem;
  }

  .theater-version-container {
    padding: 0 0.85rem;
    grid-template-columns: 1fr;
    gap: 0.65rem;
  }

  .theater-episodes-section {
    padding: 0 0.85rem;
  }

  .theater-ep-cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
    gap: 0.5rem;
  }

  .ep-card-btn {
    height: 48px;
    font-size: 1.05rem;
  }

  .ep-nav-toolbar {
    margin: 0 0.85rem;
    padding: 0.65rem 0.75rem;
  }

  .stream-notice-row {
    padding: 0 0.85rem;
  }

  .watch-info-card {
    margin: 0 0.85rem;
    padding: 1rem;
    border-radius: 10px;
  }
}

/* Direct Fansub Subtitle Overlay (Timpa Subtitle Rusia) */
.cinema-subtitle-overlay {
  position: absolute;
  bottom: 12px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
  z-index: 25;
  padding: 0 1rem;
  text-align: center;
  transition: bottom 0.2s ease;
}

.theater-player-box.controls-active .cinema-subtitle-overlay {
  bottom: 54px;
}

.cinema-subtitle-box {
  display: inline-block;
  background: rgba(0, 0, 0, 0.92);
  color: #ffffff;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: clamp(1.05rem, 2.2vw, 1.45rem);
  font-weight: 800;
  line-height: 1.35;
  padding: 4px 14px;
  border-radius: 6px;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  text-shadow: 
    -1.5px -1.5px 0 #000,  
     1.5px -1.5px 0 #000,
    -1.5px  1.5px 0 #000,
     1.5px  1.5px 0 #000,
     0 2px 6px rgba(0, 0, 0, 0.95);
  letter-spacing: 0.025em;
  max-width: 90%;
  backdrop-filter: blur(4px);
  box-sizing: border-box;
}

/* Floating Cinema Top Action Bar & Buttons */
.cinema-top-action-bar {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cinema-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(15, 23, 42, 0.9);
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  color: #ffffff;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 0.92;
}

.cinema-action-btn:hover,
.cinema-action-btn:active {
  opacity: 1;
  transform: scale(1.04);
}

.cinema-fullscreen-toggle-btn {
  border-color: rgba(229, 9, 20, 0.7);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6), 0 0 12px rgba(229, 9, 20, 0.35);
}

.cinema-fullscreen-toggle-btn:hover,
.cinema-fullscreen-toggle-btn:active {
  background: rgba(229, 9, 20, 0.95);
  box-shadow: 0 6px 20px rgba(229, 9, 20, 0.55);
}

.cinema-rotate-btn {
  border-color: rgba(59, 130, 246, 0.7);
  background: rgba(30, 58, 138, 0.85);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6), 0 0 12px rgba(59, 130, 246, 0.35);
}

.cinema-rotate-btn:hover,
.cinema-rotate-btn:active {
  background: rgba(37, 99, 235, 0.95);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.55);
}

/* Fullscreen Mode (Native Fullscreen & CSS Pseudo Fullscreen) */
#theaterBox:fullscreen,
.theater-player-box:fullscreen,
.theater-player-box.is-theater-fullscreen {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: 100vw !important;
  max-height: 100vh !important;
  z-index: 2147483647 !important;
  background: #000000 !important;
  border-radius: 0 !important;
  border: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* Forced Landscape CSS (Rotates video 90deg horizontally if device is portrait) */
.theater-player-box.is-forced-landscape-css {
  transform: rotate(90deg) !important;
  transform-origin: center center !important;
  width: 100vh !important;
  height: 100vw !important;
  position: fixed !important;
  top: 50% !important;
  left: 50% !important;
  margin-top: -50vw !important;
  margin-left: -50vh !important;
  z-index: 2147483647 !important;
}

#theaterBox:fullscreen .native-hls-player,
.theater-player-box:fullscreen .native-hls-player,
.theater-player-box.is-theater-fullscreen .native-hls-player {
  width: 100% !important;
  height: 100% !important;
  border-radius: 0 !important;
  object-fit: contain !important;
}

#theaterBox:fullscreen .cinema-top-action-bar,
.theater-player-box:fullscreen .cinema-top-action-bar,
.theater-player-box.is-theater-fullscreen .cinema-top-action-bar {
  top: 20px !important;
  right: 20px !important;
  z-index: 2147483647 !important;
}

/* Subtitle Overlay in Fullscreen (Orientation-Aware Positioning) */
#theaterBox:fullscreen .cinema-subtitle-overlay,
.theater-player-box:fullscreen .cinema-subtitle-overlay,
.theater-player-box.is-theater-fullscreen .cinema-subtitle-overlay {
  position: absolute !important;
  left: 0 !important;
  right: 0 !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  z-index: 2147483647 !important;
  pointer-events: none !important;
  padding: 0 1.5rem !important;
}

/* In Landscape or Forced Landscape: Sit neatly at bottom */
@media (orientation: landscape) {
  #theaterBox:fullscreen .cinema-subtitle-overlay,
  .theater-player-box:fullscreen .cinema-subtitle-overlay,
  .theater-player-box.is-theater-fullscreen .cinema-subtitle-overlay {
    bottom: clamp(24px, 6.5vh, 48px) !important;
  }
}

.theater-player-box.is-forced-landscape-css .cinema-subtitle-overlay {
  bottom: clamp(24px, 6.5vw, 48px) !important;
}

/* In Portrait Mode: Align directly over 16:9 letterbox in center */
@media (orientation: portrait) {
  #theaterBox.is-theater-fullscreen:not(.is-forced-landscape-css) .cinema-subtitle-overlay {
    bottom: calc(50% - 28.125vw + 16px) !important;
  }
}

#theaterBox:fullscreen .cinema-subtitle-box,
.theater-player-box:fullscreen .cinema-subtitle-box,
.theater-player-box.is-theater-fullscreen .cinema-subtitle-box {
  font-size: clamp(1.35rem, 3.2vw, 2.3rem) !important;
  padding: 8px 26px !important;
  max-width: 90% !important;
  background: rgba(0, 0, 0, 0.94) !important;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.98) !important;
  border: 1.5px solid rgba(255, 255, 255, 0.22) !important;
  border-radius: 8px !important;
}
</style>

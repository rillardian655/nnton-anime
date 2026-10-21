<template>
  <div class="schedule-clean-page">
    <main class="schedule-inner-container">
      
      <!-- Top Segmented Switcher (Jadwal Harian vs LiveChart Musim - Matching Foto 3) -->
      <div class="flex items-center justify-center my-2">
        <div class="inline-flex gap-1 p-1 bg-[#13151f] border border-white/5 rounded-full shadow-inner">
          <button 
            class="px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold rounded-full bg-blue-600 text-white shadow-md transition cursor-default whitespace-nowrap"
          >
            Jadwal Harian
          </button>
          <router-link 
            to="/livechart" 
            class="px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-full text-slate-400 hover:text-white transition whitespace-nowrap"
          >
            LiveChart Musim
          </router-link>
        </div>
      </div>

      <!-- Top Clean Title (Matching Foto 2 & 3) -->
      <div class="schedule-header-bar">
        <h1 class="schedule-title-main">Jadwal Tayang</h1>
      </div>

      <!-- Top 7-Days Bar (Matching Foto 2) -->
      <nav class="days-strip-container">
        <div class="days-strip-row">
          <button 
            v-for="d in daysList" 
            :key="d.name"
            class="day-strip-btn"
            :class="{ 'is-active': activeDayKey === d.name }"
            @click="activeDayKey = d.name"
          >
            <span class="day-short-label">{{ d.shortName }}</span>
            <span class="day-date-number">{{ d.dateNum }}</span>
            <span v-if="activeDayKey === d.name" class="active-dot-indicator"></span>
          </button>
        </div>
      </nav>

      <!-- Category Filter Pills (Minimalist, No Emojis, Matching Foto 2 & 3) -->
      <div class="filter-segmented-bar">
        <div class="filter-segmented-row">
          <button 
            class="filter-tab-pill" 
            :class="{ active: activeFilter === 'all' }"
            @click="activeFilter = 'all'"
          >
            Semua ({{ currentDayData?.totalCount || 0 }})
          </button>

          <button 
            class="filter-tab-pill" 
            :class="{ active: activeFilter === 'airing' }"
            @click="activeFilter = 'airing'"
          >
            Sudah Tayang ({{ currentDayData?.airing?.length || 0 }})
          </button>

          <button 
            class="filter-tab-pill" 
            :class="{ active: activeFilter === 'upcoming' }"
            @click="activeFilter = 'upcoming'"
          >
            Menunggu Update ({{ currentDayData?.upcoming?.length || 0 }})
          </button>

          <button 
            class="filter-tab-pill" 
            :class="{ active: activeFilter === 'finished' }"
            @click="activeFilter = 'finished'"
          >
            Tamat &lt;15 Hari ({{ currentDayData?.finished?.length || 0 }})
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="schedule-state-box">
        <span class="clean-spinner"></span>
        <p class="state-msg">Memuat jadwal tayang...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="schedule-state-box">
        <p class="error-text">{{ error }}</p>
        <button class="btn btn-secondary btn-sm" @click="loadSchedule">Coba Lagi</button>
      </div>

      <!-- Anime Timeline List (Matching Foto 2 & 3) -->
      <div v-else class="timeline-list-wrap">
        <div v-if="displayAnimeList.length > 0" class="timeline-items-col">
          <div 
            v-for="anime in displayAnimeList" 
            :key="anime.category + '-' + anime.id"
            class="timeline-card"
            @click="handleCardClick(anime)"
          >
            <!-- Left Side Accent Border -->
            <div 
              class="card-edge-strip" 
              :class="{
                'edge-airing': anime.category === 'airing',
                'edge-upcoming': anime.category === 'upcoming',
                'edge-finished': anime.category === 'finished'
              }"
            ></div>

            <!-- Time Column -->
            <div class="card-time-block">
              <span class="time-main-text">{{ anime.timeText || '00:00' }}</span>
            </div>

            <!-- Poster Thumbnail -->
            <div class="card-thumb-block">
              <img 
                :src="getSafeImageUrl(anime.coverImage?.large || anime.coverImage?.extraLarge)" 
                :alt="anime.title?.english || anime.title?.romaji" 
                loading="lazy" 
              />
            </div>

            <!-- Details Block -->
            <div class="card-body-block">
              <h2 class="anime-title-heading" :title="anime.title?.english || anime.title?.romaji">
                {{ anime.title?.english || anime.title?.romaji }}
              </h2>

              <div class="anime-episode-line">
                <span v-if="anime.category === 'finished'">Tamat • {{ anime.episodes || 'Selesai' }} Episode</span>
                <span v-else>Episode {{ anime.currentEpisode || 1 }}</span>
              </div>

              <div class="anime-stats-line">
                <span class="meta-score" v-if="anime.averageScore">
                  ★ {{ (anime.averageScore / 10).toFixed(1) }}
                </span>
                <span class="meta-separator" v-if="anime.genres?.length">•</span>
                <span class="meta-genre-text">{{ (anime.genres || []).slice(0, 2).join(', ') }}</span>
              </div>

              <!-- Status text with subtle dot -->
              <div class="anime-status-line">
                <span 
                  class="status-dot" 
                  :class="{
                    'dot-gold': anime.category === 'airing',
                    'dot-gray': anime.category === 'upcoming',
                    'dot-blue': anime.category === 'finished'
                  }"
                ></span>
                <span class="status-name-text">{{ anime.statusLabel }}</span>
              </div>
            </div>

            <!-- Quick Action Icon -->
            <div class="card-action-block">
              <button 
                type="button"
                class="play-circle-btn" 
                @click.stop="handlePlayClick(anime)"
                title="Tonton Episode"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="schedule-empty-state">
          <p>Tidak ada jadwal anime untuk kategori ini pada hari {{ activeDayKey }}.</p>
        </div>
      </div>

      <!-- Floating Bottom Day Switchers (Matching Foto 2) -->
      <aside class="floating-day-nav">
        <button class="nav-jump-btn btn-prev" @click="goToAdjacentDay(-1)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <span>{{ prevDayName }}</span>
        </button>
        <button class="nav-jump-btn btn-next" @click="goToAdjacentDay(1)">
          <span>{{ nextDayName }}</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </aside>

    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { getWeeklySchedule, getSafeImageUrl } from '../api.js';
import { isAuthenticated, showLoginModal } from '../stores/auth.js';

const router = useRouter();

function handlePlayClick(anime) {
  if (!isAuthenticated.value) {
    showLoginModal.value = true;
    return;
  }
  router.push(`/watch?id=${anime.id}&ep=${anime.currentEpisode || 1}`);
}

const emit = defineEmits(['openAnimeModal']);

const dayKeys = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const dayShorts = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const activeDayKey = ref('Rabu');
const activeFilter = ref('all');

const scheduleData = ref(null);
const loading = ref(true);
const error = ref(null);

const currentDayData = computed(() => {
  if (!scheduleData.value?.days) return null;
  return scheduleData.value.days[activeDayKey.value] || null;
});

const daysList = computed(() => {
  const result = [];
  const daysObj = scheduleData.value?.days || {};
  dayKeys.forEach((key, idx) => {
    const d = daysObj[key];
    result.push({
      name: key,
      shortName: dayShorts[idx],
      dateNum: d?.dateNum || `${19 + idx}`,
      isToday: !!d?.isToday,
      totalCount: d?.totalCount || 0
    });
  });
  return result;
});

const displayAnimeList = computed(() => {
  const d = currentDayData.value;
  if (!d) return [];

  if (activeFilter.value === 'airing') {
    return d.airing || [];
  } else if (activeFilter.value === 'upcoming') {
    return d.upcoming || [];
  } else if (activeFilter.value === 'finished') {
    return d.finished || [];
  }

  // 'all': combine all categories in logical sequence: Airing -> Upcoming -> Finished (<15d)
  return [...(d.airing || []), ...(d.upcoming || []), ...(d.finished || [])];
});

const currentDayIndex = computed(() => {
  return dayKeys.indexOf(activeDayKey.value);
});

const prevDayName = computed(() => {
  const idx = (currentDayIndex.value - 1 + 7) % 7;
  return dayKeys[idx];
});

const nextDayName = computed(() => {
  const idx = (currentDayIndex.value + 1) % 7;
  return dayKeys[idx];
});

function goToAdjacentDay(step) {
  const newIdx = (currentDayIndex.value + step + 7) % 7;
  activeDayKey.value = dayKeys[newIdx];
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleCardClick(anime) {
  emit('openAnimeModal', anime);
}

async function loadSchedule() {
  loading.value = true;
  error.value = null;
  try {
    const data = await getWeeklySchedule();
    scheduleData.value = data;
    if (data.today && dayKeys.includes(data.today)) {
      activeDayKey.value = data.today;
    }
  } catch (err) {
    console.error('Schedule fetch error:', err);
    error.value = 'Gagal memuat jadwal tayang anime.';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  document.title = 'Jadwal Tayang Anime — AniPulse';
  loadSchedule();
});
</script>

<style scoped>
.schedule-clean-page {
  min-height: 100vh;
  background-color: #0c0d12;
  color: #f1f5f9;
  padding-bottom: 7rem;
}

.schedule-inner-container {
  max-width: 680px;
  margin: 0 auto;
  padding: 1.25rem 1rem;
}

/* ================= Header Title (Foto 2) ================= */
.schedule-header-bar {
  text-align: center;
  padding: 0.5rem 0 1.25rem;
}

.schedule-title-main {
  font-size: 1.35rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.2px;
}

/* ================= Day Strip Bar (Foto 2) ================= */
.days-strip-container {
  margin-bottom: 1.25rem;
}

.days-strip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  background: #13151f;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 14px;
  padding: 0.45rem 0.5rem;
}

.day-strip-btn {
  flex: 1;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.45rem 0.2rem;
  border-radius: 10px;
  position: relative;
  transition: all 0.15s ease;
}

.day-short-label {
  font-size: 0.72rem;
  font-weight: 500;
  color: #64748b;
}

.day-date-number {
  font-size: 0.95rem;
  font-weight: 700;
  color: #94a3b8;
}

.day-strip-btn:hover .day-short-label,
.day-strip-btn:hover .day-date-number {
  color: #e2e8f0;
}

.day-strip-btn.is-active {
  background: #2563eb;
  color: #ffffff;
}

.day-strip-btn.is-active .day-short-label,
.day-strip-btn.is-active .day-date-number {
  color: #ffffff;
}

.active-dot-indicator {
  position: absolute;
  bottom: -4px;
  width: 4px;
  height: 4px;
  background: #3b82f6;
  border-radius: 50%;
  display: none;
}

/* ================= Filter Segmented Bar ================= */
.filter-segmented-bar {
  margin-bottom: 1.25rem;
}

.filter-segmented-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 0.25rem;
}

.filter-segmented-row::-webkit-scrollbar {
  display: none;
}

.filter-tab-pill {
  background: #141620;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 9999px;
  padding: 0.4rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #828ba0;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.filter-tab-pill:hover {
  color: #cbd5e1;
  background: #1a1d2b;
}

.filter-tab-pill.active {
  background: #202436;
  border-color: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}

/* ================= Timeline List (Foto 2) ================= */
.timeline-list-wrap {
  position: relative;
}

.timeline-items-col {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.timeline-card {
  position: relative;
  background: #141620;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  display: flex;
  align-items: center;
  padding: 0.75rem 0.85rem;
  gap: 0.75rem;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.15s ease;
}

.timeline-card:hover {
  background: #181b28;
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-1px);
}

/* Left Accent Strip (Foto 2) */
.card-edge-strip {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3.5px;
  background: transparent;
}

.edge-airing { background: #eab308; }
.edge-upcoming { background: #64748b; }
.edge-finished { background: #3b82f6; }

/* Time Block */
.card-time-block {
  min-width: 46px;
  text-align: center;
}

.time-main-text {
  font-size: 0.95rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.3px;
}

/* Thumbnail Block */
.card-thumb-block {
  width: 54px;
  height: 72px;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}

.card-thumb-block img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Details Block */
.card-body-block {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.anime-title-heading {
  font-size: 0.88rem;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.anime-episode-line {
  font-size: 0.76rem;
  color: #94a3b8;
  font-weight: 500;
}

.anime-stats-line {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: #64748b;
}

.meta-score {
  color: #fbbf24;
  font-weight: 700;
}

.meta-separator {
  color: #475569;
}

.meta-genre-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.anime-status-line {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 600;
  margin-top: 0.15rem;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-gold { background: #eab308; }
.dot-gray { background: #94a3b8; }
.dot-blue { background: #3b82f6; }

.status-name-text {
  color: #94a3b8;
}

/* Play Action */
.card-action-block {
  flex-shrink: 0;
}

.play-circle-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  text-decoration: none;
  border: none;
  cursor: pointer;
}

.play-circle-btn:hover {
  background: #ff4d2e;
  color: #fff;
  transform: scale(1.08);
}

/* Empty & Loading */
.schedule-empty-state {
  text-align: center;
  padding: 3.5rem 1rem;
  background: #141620;
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  color: #64748b;
  font-size: 0.86rem;
}

.schedule-state-box {
  text-align: center;
  padding: 4rem 1rem;
}

.clean-spinner {
  display: inline-block;
  width: 30px;
  height: 30px;
  border: 2.5px solid rgba(255, 255, 255, 0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.state-msg {
  margin-top: 0.75rem;
  font-size: 0.84rem;
  color: #828ba0;
}

.error-text {
  color: #ef4444;
  font-size: 0.86rem;
  margin-bottom: 0.75rem;
}

/* ================= Floating Day Switchers (Foto 2) ================= */
.floating-day-nav {
  position: fixed;
  bottom: 4.8rem;
  left: 0;
  right: 0;
  max-width: 680px;
  margin: 0 auto;
  padding: 0 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
  z-index: 30;
}

.nav-jump-btn {
  pointer-events: auto;
  background: rgba(18, 20, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.5rem 0.9rem;
  border-radius: 9999px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  transition: all 0.15s ease;
}

.nav-jump-btn:hover {
  background: #2563eb;
  border-color: #3b82f6;
  transform: translateY(-2px);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

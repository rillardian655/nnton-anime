<template>
  <div class="min-h-screen bg-[#0c0d12] text-slate-100 pb-28 pt-2 sm:pt-4">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">

      <!-- Top Segmented Switcher (Jadwal Harian vs LiveChart Musim - Matching Foto 3) -->
      <div class="flex items-center justify-center my-3">
        <div class="inline-flex gap-1 p-1 bg-[#13151f] border border-white/5 rounded-full shadow-inner">
          <router-link 
            to="/schedule" 
            class="px-4 sm:px-5 py-2 text-xs sm:text-sm font-semibold rounded-full text-slate-400 hover:text-white transition whitespace-nowrap"
          >
            Jadwal Harian
          </router-link>
          <button 
            class="px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold rounded-full bg-blue-600 text-white shadow-md transition whitespace-nowrap cursor-default"
          >
            LiveChart Musim
          </button>
        </div>
      </div>

      <!-- Header Section -->
      <header class="text-center py-3 mb-2">
        <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
          LiveChart — Bagan Musim Anime
        </h1>
        <p class="text-xs sm:text-sm text-slate-400 mt-1">
          Jadwal rilis anime musim ini & musim mendatang secara real-time
        </p>
      </header>

      <!-- Season Selector Tabs (Strictly Current & Future only - NO past seasons) -->
      <nav class="mb-5 overflow-x-auto scrollbar-none py-1">
        <div class="flex items-center gap-2 justify-start sm:justify-center min-w-max">
          <button
            v-for="s in seasonsList"
            :key="s.key"
            @click="selectSeason(s)"
            class="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all border flex items-center gap-2 whitespace-nowrap cursor-pointer"
            :class="[
              activeSeasonKey === s.key
                ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-400'
                : 'bg-[#141620] border-white/5 text-slate-300 hover:bg-[#1a1d2b] hover:text-white'
            ]"
          >
            <span v-if="s.isCurrent" class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>{{ s.label }}</span>
          </button>
        </div>
      </nav>

      <!-- Filter Controls Bar -->
      <div class="bg-[#141620] border border-white/5 rounded-2xl p-3 sm:p-4 mb-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <!-- Format Pills -->
        <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 md:pb-0">
          <button
            v-for="f in formatOptions"
            :key="f.value"
            @click="selectedFormat = f.value"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer"
            :class="[
              selectedFormat === f.value
                ? 'bg-slate-700 text-white border border-white/20'
                : 'bg-transparent text-slate-400 hover:text-slate-200'
            ]"
          >
            {{ f.label }}
          </button>
        </div>

        <!-- Right Side: Search & Sort -->
        <div class="flex items-center gap-2.5">
          <!-- Quick Search -->
          <div class="relative flex-1 md:w-56">
            <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Cari di musim ini..." 
              class="w-full bg-[#0c0d12] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <!-- Sort Dropdown -->
          <select 
            v-model="selectedSort" 
            class="bg-[#0c0d12] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="POPULARITY_DESC">Paling Populer</option>
            <option value="SCORE_DESC">Rating Tertinggi</option>
            <option value="START_DATE">Tanggal Rilis</option>
            <option value="TITLE_ROMAJI">Judul (A-Z)</option>
          </select>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-20">
        <div class="inline-block w-8 h-8 border-3 border-white/10 border-t-blue-500 rounded-full animate-spin"></div>
        <p class="text-sm text-slate-400 mt-3 font-medium">Memuat bagan anime...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-16 bg-[#141620] border border-white/5 rounded-2xl">
        <p class="text-sm text-red-400 mb-3">{{ error }}</p>
        <button @click="loadData" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold">
          Coba Lagi
        </button>
      </div>

      <!-- Anime Grid -->
      <div v-else>
        <div v-if="filteredAnimeList.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <article 
            v-for="anime in filteredAnimeList" 
            :key="anime.id"
            class="group bg-[#141620] border border-white/5 hover:border-blue-500/30 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200 flex flex-col cursor-pointer"
            @click="handleAnimeClick(anime)"
          >
            <!-- Card Image Area with Badges -->
            <div class="relative aspect-video w-full overflow-hidden bg-black/40">
              <img 
                :src="getSafeImageUrl(anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large)" 
                :alt="anime.title?.english || anime.title?.romaji"
                loading="lazy"
                class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-[#141620] via-transparent to-black/30"></div>

              <!-- Top Left: Format Badge -->
              <div class="absolute top-2.5 left-2.5 bg-black/70 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">
                {{ formatLabel(anime.format) }}
              </div>

              <!-- Top Right: Release Date / Airing -->
              <div v-if="anime.startDateFormatted" class="absolute top-2.5 right-2.5 bg-blue-950/80 backdrop-blur-md border border-blue-500/30 text-blue-300 text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                <span>{{ anime.startDateFormatted }}</span>
              </div>

              <!-- Bottom Score Badge -->
              <div v-if="anime.displayScore" class="absolute bottom-2 left-2.5 flex items-center gap-1 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-md border border-amber-500/20 text-amber-400 font-bold text-[11px]">
                <span>★</span>
                <span>{{ anime.displayScore }}</span>
              </div>
            </div>

            <!-- Card Body Content -->
            <div class="p-3.5 flex-1 flex flex-col justify-between">
              <div>
                <!-- Studio & Source Badges -->
                <div class="flex items-center gap-1.5 mb-1.5 text-[11px] text-slate-400 font-medium">
                  <span class="text-blue-400 font-semibold truncate max-w-[140px]">{{ anime.studio || 'TBA' }}</span>
                  <span class="text-slate-600">•</span>
                  <span class="truncate max-w-[100px]">{{ formatSource(anime.source) }}</span>
                  <span v-if="anime.episodes" class="ml-auto text-slate-400 font-semibold">{{ anime.episodes }} Ep</span>
                </div>

                <!-- Title -->
                <h3 
                  class="font-bold text-sm text-white line-clamp-1 group-hover:text-blue-400 transition" 
                  :title="anime.title?.english || anime.title?.romaji"
                >
                  {{ anime.title?.english || anime.title?.romaji }}
                </h3>

                <!-- Genres -->
                <div class="flex flex-wrap gap-1 mt-2">
                  <span 
                    v-for="g in (anime.genres || []).slice(0, 3)" 
                    :key="g"
                    class="text-[10px] bg-white/5 border border-white/5 text-slate-300 px-2 py-0.5 rounded-md font-medium"
                  >
                    {{ g }}
                  </span>
                </div>

                <!-- Synopsis snippet -->
                <p class="text-[11px] text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                  {{ cleanDescription(anime.description) }}
                </p>
              </div>

              <!-- Action Bar -->
              <div class="mt-3.5 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                <button 
                  class="flex-1 py-1.5 px-3 bg-white/5 hover:bg-white/10 text-slate-200 rounded-lg text-xs font-semibold text-center transition"
                  @click.stop="handleAnimeClick(anime)"
                >
                  Lihat Detail
                </button>

                <button 
                  type="button"
                  v-if="anime.status === 'RELEASING' || anime.status === 'FINISHED'"
                  @click.stop="handlePlayClick(anime)"
                  class="py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  <span>Tonton</span>
                </button>

                <a 
                  v-else-if="anime.trailer?.id && anime.trailer?.site === 'youtube'"
                  :href="`https://www.youtube.com/watch?v=${anime.trailer.id}`" 
                  target="_blank" 
                  rel="noopener"
                  class="py-1.5 px-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  @click.stop
                >
                  <span>Trailer</span>
                </a>
              </div>
            </div>
          </article>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-20 bg-[#141620] border border-white/5 rounded-2xl">
          <p class="text-sm text-slate-400">Tidak ada anime yang cocok dengan filter yang dipilih.</p>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { getLiveChart, getSafeImageUrl } from '../api.js';
import { isAuthenticated, showLoginModal } from '../stores/auth.js';

const router = useRouter();

function handlePlayClick(anime) {
  if (!isAuthenticated.value) {
    showLoginModal.value = true;
    return;
  }
  router.push(`/watch?id=${anime.id}&ep=1`);
}

const emit = defineEmits(['openAnimeModal']);

const seasonsList = ref([]);
const activeSeasonKey = ref('current');
const currentSeasonTarget = ref({ season: 'FALL', year: 2026 });

const animeList = ref([]);
const loading = ref(true);
const error = ref(null);

const selectedFormat = ref('ALL');
const selectedSort = ref('POPULARITY_DESC');
const searchQuery = ref('');

const formatOptions = [
  { label: 'Semua Format', value: 'ALL' },
  { label: 'TV Series', value: 'TV' },
  { label: 'Movie', value: 'MOVIE' },
  { label: 'ONA / OVA', value: 'ONA' },
  { label: 'Spesial', value: 'SPECIAL' }
];

async function loadData() {
  loading.value = true;
  error.value = null;
  try {
    const isTba = activeSeasonKey.value === 'tba';
    const params = {
      season: isTba ? 'TBA' : currentSeasonTarget.value.season,
      year: isTba ? null : currentSeasonTarget.value.year,
      sort: selectedSort.value,
      format: selectedFormat.value,
      perPage: 50
    };

    const res = await getLiveChart(params);
    if (res.availableSeasons && res.availableSeasons.length > 0) {
      seasonsList.value = res.availableSeasons;
    }
    animeList.value = res.items || [];
  } catch (err) {
    console.error('Failed to load LiveChart:', err);
    error.value = 'Gagal memuat data bagan musim anime.';
  } finally {
    loading.value = false;
  }
}

function selectSeason(s) {
  activeSeasonKey.value = s.key;
  currentSeasonTarget.value = {
    season: s.season,
    year: s.year
  };
  loadData();
}

watch([selectedSort, selectedFormat], () => {
  loadData();
});

const filteredAnimeList = computed(() => {
  let list = animeList.value;
  if (!searchQuery.value.trim()) return list;

  const q = searchQuery.value.toLowerCase().trim();
  return list.filter(m => {
    const romaji = (m.title?.romaji || '').toLowerCase();
    const english = (m.title?.english || '').toLowerCase();
    const studio = (m.studio || '').toLowerCase();
    return romaji.includes(q) || english.includes(q) || studio.includes(q);
  });
});

function handleAnimeClick(anime) {
  emit('openAnimeModal', anime);
}

function formatLabel(fmt) {
  if (!fmt) return 'TV';
  if (fmt === 'TV_SHORT') return 'TV Short';
  return fmt;
}

function formatSource(src) {
  if (!src) return 'Original';
  const map = {
    'MANGA': 'Manga',
    'LIGHT_NOVEL': 'Light Novel',
    'VISUAL_NOVEL': 'Visual Novel',
    'ORIGINAL': 'Original',
    'VIDEO_GAME': 'Game',
    'WEB_MANGA': 'Web Manga'
  };
  return map[src] || src.replace('_', ' ');
}

function cleanDescription(desc) {
  if (!desc) return 'Belum ada sinopsis tersedia.';
  return desc.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
}

onMounted(() => {
  document.title = 'LiveChart — Bagan Musim Anime';
  loadData();
});
</script>

<style scoped>
/* Tailwind handles the styling */
</style>

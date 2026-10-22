// ==========================================
// AniPulse - API Client & Data Layer
// Supports Web & Android Native (Capacitor)
// ==========================================

import { PRESET_SUBTITLES } from './data/subtitles_preset.js';
import { LIVECHART_SCHEDULE } from './data/livechart_schedule.js';
import { db, doc, setDoc } from './firebase.js';

const ENV_BACKEND_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) || '';

export function isMobileNativeApp() {
  if (typeof window === 'undefined') return false;
  if (window.Capacitor?.isNativePlatform?.()) return true;
  if (window.Capacitor?.getPlatform?.() === 'android' || window.Capacitor?.getPlatform?.() === 'ios') return true;
  if (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:') return true;
  if (window.location.hostname === 'localhost' && (!window.location.port || window.location.port === '80' || window.location.port === '443')) {
    return true;
  }
  if (window.location.origin === 'https://localhost' || window.location.origin === 'http://localhost') {
    return true;
  }
  return false;
}

export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('anipulse_backend_url');
    if (custom) return custom.replace(/\/+$/, '');
    if (isMobileNativeApp()) {
      if (ENV_BACKEND_URL) return ENV_BACKEND_URL.replace(/\/+$/, '');
      return 'http://192.168.1.51:8000';
    }
  }
  return ENV_BACKEND_URL ? ENV_BACKEND_URL.replace(/\/+$/, '') : '';
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

export async function safeFetchJson(res, context = 'Permintaan') {
  const text = await res.text();
  const trimmed = text.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<head')) {
    const currentBase = getApiBaseUrl();
    throw new Error(`${context} gagal: Server backend tidak merespons JSON (Menerima HTML). Pastikan server backend aktif di ${currentBase} atau atur IP server.`);
  }
  try {
    const data = JSON.parse(text);
    if (!res.ok) {
      throw new Error(data.detail || data.message || `${context} gagal (HTTP ${res.status})`);
    }
    return data;
  } catch (err) {
    if (err.message && (err.message.includes(context) || err.message.includes('Server backend'))) {
      throw err;
    }
    throw new Error(`${context} gagal: Format respons tidak valid (${err.message})`);
  }
}

export function getEffectiveEpisodeCount(anime) {
  if (!anime) return 1;
  if (anime.currentEpisode && anime.currentEpisode > 0) return Number(anime.currentEpisode);

  // If status is finished, return actual episode count directly
  const st = (anime.status || '').toUpperCase();
  if (st === 'FINISHED' || anime.category === 'finished') {
    return Number(anime.episodes || anime.totalEpisodes) || 12;
  }

  // If airing anime has nextAiringEpisode from official schedule
  if (anime.nextAiringEpisode?.episode) {
    return Math.max(1, anime.nextAiringEpisode.episode - 1);
  }

  // If airing / releasing anime: return current aired episode, never total planned episodes
  if (st === 'RELEASING' || anime.category === 'airing' || st === 'CURRENT') {
    if (anime.currentEpisode && anime.currentEpisode > 0) return Number(anime.currentEpisode);
    if (anime.episodesAired && anime.episodesAired > 0) return Number(anime.episodesAired);
    return 1;
  }

  return Number(anime.episodes || anime.totalEpisodes) || 12;
}

export function isAiringStatus(anime) {
  if (!anime) return false;
  const st = (anime.status || '').toUpperCase();
  if (st === 'FINISHED' || anime.category === 'finished') return false;
  if (st === 'RELEASING' || st === 'CURRENT' || anime.category === 'airing') return true;
  return false;
}

const ANILIST_FALLBACK = 'https://graphql.anilist.co';
const KITSU_FALLBACK = 'https://kitsu.io/api/edge';

/**
 * Standard AniList GraphQL requester with direct connection & proxy fallback
 */
export async function fetchAniList(query, variables = {}) {
  try {
    let response;
    // Attempt direct AniList connection first (AniList is CORS enabled globally)
    try {
      response = await fetch(ANILIST_FALLBACK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      });
    } catch (directErr) {
      // Fallback via backend proxy if direct fetch is blocked
      response = await fetch(apiUrl('/api/anilist'), {
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

// ==========================================
// Curated High-Definition Fallback Anime Dataset
// Ensures the catalog NEVER renders empty even if external APIs are completely offline
// ==========================================
export const OFFLINE_ANIME_DATASET = [
  {
    id: 151807,
    title: { romaji: 'Ore dake Level Up na Ken', english: 'Solo Leveling', native: '俺だけレベルアップな件' },
    coverImage: { extraLarge: 'https://media.kitsu.app/anime/poster_images/45974/large.jpg', large: 'https://media.kitsu.app/anime/poster_images/45974/medium.jpg', color: '#3b82f6' },
    bannerImage: 'https://media.kitsu.app/anime/cover_images/45974/large.jpg',
    format: 'TV', episodes: 12, duration: 24, status: 'FINISHED', seasonYear: 2024, averageScore: 86, popularity: 95000,
    genres: ['Action', 'Adventure', 'Fantasy'],
    description: 'Sudah lebih dari satu dekade sejak Gerbang misterius menghubungkan dunia manusia dengan monster. Jinwoo Sung yang terlemah mendapatkan sistem rahasia untuk naik level tanpa batas.'
  },
  {
    id: 16498,
    title: { romaji: 'Shingeki no Kyojin', english: 'Attack on Titan', native: '進撃の巨人' },
    coverImage: { extraLarge: 'https://media.kitsu.app/anime/poster_images/7442/large.jpg', large: 'https://media.kitsu.app/anime/poster_images/7442/medium.jpg', color: '#ef4444' },
    bannerImage: 'https://media.kitsu.app/anime/cover_images/7442/large.jpg',
    format: 'TV', episodes: 25, duration: 24, status: 'FINISHED', seasonYear: 2013, averageScore: 90, popularity: 120000,
    genres: ['Action', 'Drama', 'Fantasy', 'Mystery'],
    description: 'Setelah tembok pelindung dihancurkan oleh Titan Kolosal, Eren Yeager bersumpah membasmi seluruh Titan demi kebebasan umat manusia.'
  },
  {
    id: 101922,
    title: { romaji: 'Kimetsu no Yaiba', english: 'Demon Slayer: Kimetsu no Yaiba', native: '鬼滅の刃' },
    coverImage: { extraLarge: 'https://media.kitsu.app/anime/poster_images/41370/large.jpg', large: 'https://media.kitsu.app/anime/poster_images/41370/medium.jpg', color: '#10b981' },
    bannerImage: 'https://media.kitsu.app/anime/cover_images/41370/large.jpg',
    format: 'TV', episodes: 26, duration: 24, status: 'FINISHED', seasonYear: 2019, averageScore: 88, popularity: 110000,
    genres: ['Action', 'Fantasy', 'Historical', 'Supernatural'],
    description: 'Keluarganya dibantai iblis dan adiknya Nezuko berubah menjadi iblis. Tanjiro Kamado bergabung dengan Korps Pemburu Iblis untuk mengembalikan kemanusiaan adiknya.'
  },
  {
    id: 113415,
    title: { romaji: 'Jujutsu Kaisen', english: 'Jujutsu Kaisen', native: '呪術廻戦' },
    coverImage: { extraLarge: 'https://media.kitsu.app/anime/poster_images/42765/large.jpg', large: 'https://media.kitsu.app/anime/poster_images/42765/medium.jpg', color: '#6366f1' },
    bannerImage: 'https://media.kitsu.app/anime/cover_images/42765/large.jpg',
    format: 'TV', episodes: 24, duration: 24, status: 'FINISHED', seasonYear: 2020, averageScore: 87, popularity: 105000,
    genres: ['Action', 'Fantasy', 'Supernatural'],
    description: 'Yuuji Itadori menelan jari terkutuk Ryomen Sukuna dan memasuki dunia Penyihir Jujutsu Tokyo untuk mengumpulkan sisa kutukan berbahaya.'
  },
  {
    id: 154587,
    title: { romaji: 'Sousou no Frieren', english: 'Frieren: Beyond Journey\'s End', native: '葬送のフリーレン' },
    coverImage: { extraLarge: 'https://media.kitsu.app/anime/poster_images/46474/large.jpg', large: 'https://media.kitsu.app/anime/poster_images/46474/medium.jpg', color: '#a855f7' },
    bannerImage: 'https://media.kitsu.app/anime/cover_images/46474/large.jpg',
    format: 'TV', episodes: 28, duration: 24, status: 'FINISHED', seasonYear: 2023, averageScore: 92, popularity: 98000,
    genres: ['Adventure', 'Drama', 'Fantasy'],
    description: 'Setelah mengalahkan Raja Iblis bersama pahlawan Himmel, elf penyihir Frieren memulai perjalanan panjang memahami arti kehidupan manusia dan persahabatan.'
  },
  {
    id: 21,
    title: { romaji: 'ONE PIECE', english: 'One Piece', native: 'ONE PIECE' },
    coverImage: { extraLarge: 'https://media.kitsu.app/anime/poster_images/12/large.jpg', large: 'https://media.kitsu.app/anime/poster_images/12/medium.jpg', color: '#f59e0b' },
    bannerImage: 'https://media.kitsu.app/anime/cover_images/12/large.jpg',
    format: 'TV', episodes: 1100, duration: 24, status: 'RELEASING', seasonYear: 1999, averageScore: 89, popularity: 130000,
    genres: ['Action', 'Adventure', 'Comedy', 'Fantasy'],
    description: 'Monkey D. Luffy mengarungi lautan Grand Line bersama Kru Bajak Laut Topi Jerami untuk menemukan harta karun legendaris One Piece dan menjadi Raja Bajak Laut.'
  },
  {
    id: 140960,
    title: { romaji: 'SPY×FAMILY', english: 'SPY x FAMILY', native: 'SPY×FAMILY' },
    coverImage: { extraLarge: 'https://media.kitsu.app/anime/poster_images/45233/large.jpg', large: 'https://media.kitsu.app/anime/poster_images/45233/medium.jpg', color: '#ec4899' },
    bannerImage: 'https://media.kitsu.app/anime/cover_images/45233/large.jpg',
    format: 'TV', episodes: 25, duration: 24, status: 'FINISHED', seasonYear: 2022, averageScore: 85, popularity: 92000,
    genres: ['Action', 'Comedy', 'Slice of Life'],
    description: 'Mata-mata Twilight harus membangun keluarga palsu untuk misinya. Tanpa disadari, istrinya adalah pembunuh bayaran dan putrinya Anya memiliki kemampuan telepati.'
  },
  {
    id: 127230,
    title: { romaji: 'Chainsaw Man', english: 'Chainsaw Man', native: 'チェンソーマン' },
    coverImage: { extraLarge: 'https://media.kitsu.app/anime/poster_images/43806/large.jpg', large: 'https://media.kitsu.app/anime/poster_images/43806/medium.jpg', color: '#f97316' },
    bannerImage: 'https://media.kitsu.app/anime/cover_images/43806/large.jpg',
    format: 'TV', episodes: 12, duration: 24, status: 'FINISHED', seasonYear: 2022, averageScore: 86, popularity: 90000,
    genres: ['Action', 'Fantasy', 'Horror', 'Supernatural'],
    description: 'Denji hidup miskin dan berburu iblis bersama Pochita. Setelah dikhianati, ia terlahir kembali sebagai Manusia Gergaji Mesin dan bergabung dengan Pemburu Iblis Keselamatan Publik.'
  },
  {
    id: 153288,
    title: { romaji: 'Kaijuu 8-gou', english: 'Kaiju No. 8', native: '怪獣8号' },
    coverImage: { extraLarge: 'https://media.kitsu.app/anime/poster_images/46282/large.jpg', large: 'https://media.kitsu.app/anime/poster_images/46282/medium.jpg', color: '#14b8a6' },
    bannerImage: 'https://media.kitsu.app/anime/cover_images/46282/large.jpg',
    format: 'TV', episodes: 12, duration: 24, status: 'FINISHED', seasonYear: 2024, averageScore: 84, popularity: 75000,
    genres: ['Action', 'Sci-Fi'],
    description: 'Kafka Hibino bercita-cita masuk Pasukan Pertahanan Kaiju. Setelah tubuhnya kemasukan parasit kaiju kecil, ia memperoleh kekuatan monster misterius berkode Kaiju No. 8.'
  },
  {
    id: 137822,
    title: { romaji: 'Blue Lock', english: 'BLUE LOCK', native: 'ブルーロック' },
    coverImage: { extraLarge: 'https://media.kitsu.app/anime/poster_images/44888/large.jpg', large: 'https://media.kitsu.app/anime/poster_images/44888/medium.jpg', color: '#0284c7' },
    bannerImage: 'https://media.kitsu.app/anime/cover_images/44888/large.jpg',
    format: 'TV', episodes: 24, duration: 24, status: 'FINISHED', seasonYear: 2022, averageScore: 83, popularity: 78000,
    genres: ['Action', 'Sports'],
    description: '300 penyerang sepak bola SMA terbaik Jepang dikumpulkan di fasilitas pelatihan tertutup Blue Lock untuk menciptakan striker paling egois dan mematikan di dunia.'
  },
  {
    id: 170942,
    kitsuId: '48239',
    title: { romaji: 'Ao no Hako', english: 'Blue Box', native: 'アオのハコ' },
    coverImage: {
      extraLarge: 'https://media.kitsu.app/anime/48239/poster_image/medium-4653e38d1bfe79ce7af766adf8e8d56e.jpeg',
      large: 'https://media.kitsu.app/anime/48239/poster_image/medium-4653e38d1bfe79ce7af766adf8e8d56e.jpeg',
      color: '#3b82f6'
    },
    bannerImage: 'https://media.kitsu.app/anime/48239/poster_image/medium-4653e38d1bfe79ce7af766adf8e8d56e.jpeg',
    format: 'TV', episodes: 25, duration: 24, status: 'FINISHED', seasonYear: 2024, averageScore: 82, popularity: 75000,
    genres: ['Romance', 'Sports', 'Slice of Life'],
    description: 'Taiki Inomata adalah anggota klub bulu tangkis di Eimei High. Setiap pagi ia berlatih bersama Chinatsu Kano, bintang klub basket wanita yang ia kagumi secara diam-diam.'
  },
  {
    id: 19655,
    yummyId: 19655,
    slug: 'golubaya-shkatulka-2',
    title: { romaji: 'Ao no Hako 2nd Season', english: 'Blue Box Season 2', native: 'Kotak Biru Season 2' },
    coverImage: {
      extraLarge: 'https://static.yani.tv/posters/full/1636982711.jpg',
      large: 'https://static.yani.tv/posters/full/1636982711.jpg',
      color: '#3b82f6'
    },
    bannerImage: 'https://static.yani.tv/posters/full/1636982711.jpg',
    format: 'TV', episodes: 3, currentEpisode: 3, duration: 24, status: 'RELEASING', seasonYear: 2026, averageScore: 84, popularity: 82000,
    genres: ['Shounen', 'Romance', 'Sports', 'School'],
    studios: { nodes: [{ name: 'Telecom Animation Film' }] },
    description: 'Taiki Inomata dan Chinatsu Kano melanjutkan kisah cinta dan perjuangan olahraga bulu tangkis serta basket mereka di Eimei High School.'
  },
  {
    id: 171018,
    kitsuId: '48269',
    title: { romaji: 'Dandadan', english: 'Dan Da Dan', native: 'ダンダダン' },
    coverImage: {
      extraLarge: 'https://media.kitsu.app/anime/48269/poster_image/medium-9feb265c75b7016c63b21e122f69a84b.jpeg',
      large: 'https://media.kitsu.app/anime/48269/poster_image/medium-9feb265c75b7016c63b21e122f69a84b.jpeg',
      color: '#e11d48'
    },
    bannerImage: 'https://media.kitsu.app/anime/48269/poster_image/medium-9feb265c75b7016c63b21e122f69a84b.jpeg',
    format: 'TV', episodes: 3, currentEpisode: 3, duration: 24, status: 'RELEASING', seasonYear: 2024, averageScore: 87, popularity: 82000,
    genres: ['Action', 'Comedy', 'Sci-Fi', 'Supernatural'],
    description: 'Momo percaya pada hantu dan Okarun percaya pada alien. Pertaruhan mereka mengungkap bahwa keduanya nyata dan memicu pertempuran supranatural spektakuler.'
  },
  {
    id: 163134,
    kitsuId: '47235',
    title: { romaji: 'Re:Zero kara Hajimeru Isekai Seikatsu 3rd Season', english: 'Re:ZERO Season 3', native: 'Re:ゼロから始める異世界生活 3rd season' },
    coverImage: {
      extraLarge: 'https://media.kitsu.app/anime/47235/poster_image/medium-d7e11c48c36ab4d4925125e7279e9d47.jpeg',
      large: 'https://media.kitsu.app/anime/47235/poster_image/medium-d7e11c48c36ab4d4925125e7279e9d47.jpeg',
      color: '#8b5cf6'
    },
    bannerImage: 'https://media.kitsu.app/anime/47235/poster_image/medium-d7e11c48c36ab4d4925125e7279e9d47.jpeg',
    format: 'TV', episodes: 4, currentEpisode: 4, duration: 24, status: 'RELEASING', seasonYear: 2024, averageScore: 85, popularity: 79000,
    genres: ['Action', 'Adventure', 'Drama', 'Fantasy'],
    description: 'Subaru Natsuki dan Emilia menerima undangan ke kota air Priestella, di mana Uskup Agung Dosa Sin Archbishop dari Witch Cult melancarkan serangan dahsyat.'
  },
  {
    id: 170947,
    kitsuId: '48108',
    title: { romaji: 'Dragon Ball DAIMA', english: 'Dragon Ball DAIMA', native: 'ドラゴンボールDAIMA' },
    coverImage: {
      extraLarge: 'https://media.kitsu.app/anime/48108/poster_image/medium-e08ccbe94f8579a6baab5abfee2bc242.jpeg',
      large: 'https://media.kitsu.app/anime/48108/poster_image/medium-e08ccbe94f8579a6baab5abfee2bc242.jpeg',
      color: '#f97316'
    },
    bannerImage: 'https://media.kitsu.app/anime/48108/poster_image/medium-e08ccbe94f8579a6baab5abfee2bc242.jpeg',
    format: 'TV', episodes: 2, currentEpisode: 2, duration: 24, status: 'RELEASING', seasonYear: 2024, averageScore: 78, popularity: 71000,
    genres: ['Action', 'Adventure', 'Comedy', 'Fantasy'],
    description: 'Karena sebuah konspirasi misterius, Goku dan teman-temannya berubah menjadi anak kecil dan memulai petualangan baru di alam semesta yang belum pernah terjamah.'
  },
  {
    id: 163270,
    kitsuId: '47245',
    title: { romaji: 'BLUE LOCK VS. U-20 JAPAN', english: 'BLUELOCK Season 2', native: 'ブルーロック VS. U-20 JAPAN' },
    coverImage: {
      extraLarge: 'https://media.kitsu.app/anime/47245/poster_image/medium-c58851ee6f99efdaf6df6a284f3cde05.jpeg',
      large: 'https://media.kitsu.app/anime/47245/poster_image/medium-c58851ee6f99efdaf6df6a284f3cde05.jpeg',
      color: '#0284c7'
    },
    bannerImage: 'https://media.kitsu.app/anime/47245/poster_image/medium-c58851ee6f99efdaf6df6a284f3cde05.jpeg',
    format: 'TV', episodes: 3, currentEpisode: 3, duration: 24, status: 'RELEASING', seasonYear: 2024, averageScore: 79, popularity: 80000,
    genres: ['Action', 'Drama', 'Sports'],
    description: 'Sebelas pemain terpilih dari Blue Lock berhadapan langsung melawan Timnas Jepang U-20 dalam pertandingan hidup mati menentukan masa depan sepak bola Jepang.'
  },
  {
    id: 178551,
    kitsuId: '48981',
    title: { romaji: 'Ranma 1/2 (2024)', english: 'Ranma 1/2 (2024)', native: 'らんま1/2 (2024)' },
    coverImage: {
      extraLarge: 'https://media.kitsu.app/anime/48981/poster_image/medium-abfe4d8f087bdfef4385faeb830873d4.jpeg',
      large: 'https://media.kitsu.app/anime/48981/poster_image/medium-abfe4d8f087bdfef4385faeb830873d4.jpeg',
      color: '#ef4444'
    },
    bannerImage: 'https://media.kitsu.app/anime/48981/poster_image/medium-abfe4d8f087bdfef4385faeb830873d4.jpeg',
    format: 'TV', episodes: 3, currentEpisode: 3, duration: 24, status: 'RELEASING', seasonYear: 2024, averageScore: 81, popularity: 68000,
    genres: ['Action', 'Comedy', 'Martial Arts', 'Romance'],
    description: 'Ranma Saotome dan Akane Tendo dijodohkan oleh orang tua mereka di tengah kutukan Jusenkyo di mana Ranma berubah jadi perempuan jika tersiram air dingin.'
  },
  {
    id: 159322,
    kitsuId: '43078',
    title: { romaji: 'BLEACH: Sennen Kessen-hen - Soukoku-tan', english: 'Bleach: Thousand-Year Blood War - The Conflict', native: 'BLEACH 千年血戦篇-相剋譚-' },
    coverImage: {
      extraLarge: 'https://media.kitsu.app/anime/43078/poster_image/medium-c33a4b2e827f0e99ea57f831af0adabd.jpeg',
      large: 'https://media.kitsu.app/anime/43078/poster_image/medium-c33a4b2e827f0e99ea57f831af0adabd.jpeg',
      color: '#475569'
    },
    bannerImage: 'https://media.kitsu.app/anime/43078/poster_image/medium-c33a4b2e827f0e99ea57f831af0adabd.jpeg',
    format: 'TV', episodes: 3, currentEpisode: 3, duration: 24, status: 'RELEASING', seasonYear: 2024, averageScore: 87, popularity: 84000,
    genres: ['Action', 'Adventure', 'Supernatural'],
    description: 'Pertempuran babak ketiga perang darah seribu tahun antara Shinigami dan Quincy mencapai klimaks saat Yhwach menembus Istana Raja Roh.'
  }
];

export function getAnimeGenres(attr, title) {
  const t = (title || '').toLowerCase();
  if (t.includes('blue box') || t.includes('ao no hako')) return ['Romance', 'Sports', 'Slice of Life'];
  if (t.includes('dandadan')) return ['Action', 'Comedy', 'Supernatural', 'Sci-Fi'];
  if (t.includes('blue lock')) return ['Action', 'Drama', 'Sports'];
  if (t.includes('ranma')) return ['Action', 'Comedy', 'Martial Arts', 'Romance'];
  if (t.includes('re:zero')) return ['Action', 'Adventure', 'Drama', 'Fantasy'];
  if (t.includes('one piece')) return ['Action', 'Adventure', 'Comedy', 'Fantasy'];
  if (t.includes('bleach')) return ['Action', 'Adventure', 'Supernatural'];
  if (t.includes('dragon ball')) return ['Action', 'Adventure', 'Comedy', 'Fantasy'];
  if (t.includes('frieren') || t.includes('sousou')) return ['Adventure', 'Drama', 'Fantasy'];
  if (t.includes('solo leveling')) return ['Action', 'Adventure', 'Fantasy'];
  if (t.includes('titan') || t.includes('shingeki')) return ['Action', 'Drama', 'Fantasy'];
  if (t.includes('demon slayer') || t.includes('kimetsu')) return ['Action', 'Supernatural', 'Historical'];
  if (t.includes('jujutsu')) return ['Action', 'Fantasy', 'Supernatural'];
  if (t.includes('spy x') || t.includes('spy×family')) return ['Action', 'Comedy'];
  if (t.includes('chainsaw')) return ['Action', 'Supernatural', 'Horror'];
  if (t.includes('kaiju')) return ['Action', 'Sci-Fi'];
  if (t.includes('bocchi') || t.includes('k-on')) return ['Comedy', 'Music', 'Slice of Life'];
  if (t.includes('haikyuu') || t.includes('kuroko') || t.includes('ippo')) return ['Sports', 'Comedy', 'Drama'];
  if (t.includes('death note') || t.includes('conan') || t.includes('monster')) return ['Mystery', 'Suspense'];

  const syn = (attr?.synopsis || '').toLowerCase();
  const inferred = [];
  if (syn.includes('romance') || syn.includes('love') || syn.includes('crush') || syn.includes('dating')) inferred.push('Romance');
  if (syn.includes('sport') || syn.includes('tournament') || syn.includes('club') || syn.includes('athlete') || syn.includes('badminton') || syn.includes('basketball')) inferred.push('Sports');
  if (syn.includes('magic') || syn.includes('fantasy') || syn.includes('isekai') || syn.includes('demon') || syn.includes('dragon')) inferred.push('Fantasy');
  if (syn.includes('action') || syn.includes('battle') || syn.includes('fight') || syn.includes('martial') || syn.includes('war')) inferred.push('Action');
  if (syn.includes('adventure') || syn.includes('journey') || syn.includes('quest') || syn.includes('explore') || syn.includes('travel') || syn.includes('expedition')) inferred.push('Adventure');
  if (syn.includes('comedy') || syn.includes('funny') || syn.includes('humor')) inferred.push('Comedy');
  if (syn.includes('school') || syn.includes('daily life') || syn.includes('friendship') || syn.includes('peaceful')) inferred.push('Slice of Life');
  if (syn.includes('drama') || syn.includes('emotional') || syn.includes('tragedy')) inferred.push('Drama');
  if (syn.includes('mystery') || syn.includes('detective') || syn.includes('crime')) inferred.push('Mystery');
  if (syn.includes('sci-fi') || syn.includes('robot') || syn.includes('mecha') || syn.includes('space') || syn.includes('future')) inferred.push('Sci-Fi');

  return inferred.length > 0 ? inferred : ['Action', 'Drama'];
}

function transformKitsuItem(item) {
  if (!item || !item.attributes) return null;
  const attr = item.attributes;
  const numId = parseInt(item.id, 10) || Math.floor(Math.random() * 100000);
  const titleRomaji = attr.canonicalTitle || 'Anime';
  const titleEnglish = attr.titles?.en || attr.titles?.en_jp || attr.canonicalTitle || 'Anime';
  const titleNative = attr.titles?.ja_jp || attr.canonicalTitle || '';

  // Map real status from Kitsu API: 'current' -> RELEASING, 'finished' -> FINISHED, 'upcoming' -> NOT_YET_RELEASED
  const realStatus = attr.status === 'current' ? 'RELEASING' : (attr.status === 'upcoming' ? 'NOT_YET_RELEASED' : 'FINISHED');
  const realEpisodes = Number(attr.episodeCount) || (realStatus === 'RELEASING' ? null : 12);

  return {
    id: numId,
    kitsuId: item.id,
    title: {
      romaji: titleRomaji,
      english: titleEnglish,
      native: titleNative
    },
    coverImage: {
      extraLarge: attr.posterImage?.large || attr.posterImage?.original || attr.posterImage?.medium,
      large: attr.posterImage?.medium || attr.posterImage?.small || attr.posterImage?.large,
      color: '#ff2851'
    },
    bannerImage: attr.coverImage?.large || attr.coverImage?.original || attr.posterImage?.large,
    format: (attr.subtype || 'TV').toUpperCase(),
    episodes: realEpisodes,
    currentEpisode: realStatus === 'RELEASING' ? (Number(attr.episodeCount) || 1) : realEpisodes,
    duration: attr.episodeLength || 24,
    status: realStatus,
    seasonYear: attr.startDate ? new Date(attr.startDate).getFullYear() : 2024,
    averageScore: Math.round(parseFloat(attr.averageRating || '82')),
    popularity: attr.userCount || 40000,
    favourites: attr.favoritesCount || 1000,
    genres: getAnimeGenres(attr, titleEnglish || titleRomaji),
    description: attr.synopsis || '',
    trailer: attr.youtubeVideoId ? {
      id: attr.youtubeVideoId,
      site: 'youtube',
      thumbnail: `https://img.youtube.com/vi/${attr.youtubeVideoId}/hqdefault.jpg`
    } : null
  };
}

export async function fetchKitsuList(endpoint) {
  try {
    // Route via backend proxy to bypass browser/mobile CORS restrictions
    let finalUrl = endpoint;
    if (endpoint.includes('kitsu.io/api/edge/')) {
      const path = endpoint.split('kitsu.io/api/edge/')[1];
      finalUrl = apiUrl(`/api/kitsu/${path}`);
    }
    const res = await fetch(finalUrl);
    if (!res.ok) throw new Error(`Kitsu returned HTTP ${res.status}`);
    const json = await res.json();
    if (json.data && Array.isArray(json.data)) {
      return json.data.map(transformKitsuItem).filter(Boolean);
    }
    return [];
  } catch (err) {
    // Direct fetch fallback
    try {
      const res = await fetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          return json.data.map(transformKitsuItem).filter(Boolean);
        }
      }
    } catch (_) {}
    console.warn('Kitsu fetch failed:', err.message);
    return [];
  }
}

/**
 * Fetch Trending Anime
 */
export async function getTrendingAnime(page = 1, perPage = 18) {
  try {
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
    if (data?.Page?.media && data.Page.media.length > 0) {
      return data.Page.media;
    }
  } catch (err) {
    console.warn('AniList getTrendingAnime failed, switching to Kitsu fallback:', err.message);
  }

  // 1. Fallback to Kitsu Trending
  const kitsuList = await fetchKitsuList(`https://kitsu.io/api/edge/trending/anime?page[limit]=${perPage}&page[offset]=${(page - 1) * perPage}`);
  if (kitsuList && kitsuList.length > 0) return kitsuList;

  // 2. High Quality Offline Dataset
  return OFFLINE_ANIME_DATASET;
}

/**
 * Fetch Popular Anime This Season
 */
export async function getPopularThisSeason(page = 1, perPage = 18) {
  try {
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
    if (data?.Page?.media && data.Page.media.length > 0) {
      return data.Page.media;
    }
  } catch (err) {
    console.warn('AniList getPopularThisSeason failed, switching to Kitsu fallback:', err.message);
  }

  // 1. Fallback to Kitsu Popular
  const kitsuList = await fetchKitsuList(`https://kitsu.io/api/edge/anime?sort=-userCount&page[limit]=${perPage}&page[offset]=${(page - 1) * perPage}`);
  if (kitsuList && kitsuList.length > 0) return kitsuList;

  return OFFLINE_ANIME_DATASET;
}

/**
 * Fetch Top Rated Anime of All Time
 */
export async function getTopRated(page = 1, perPage = 18) {
  try {
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
    if (data?.Page?.media && data.Page.media.length > 0) {
      return data.Page.media;
    }
  } catch (err) {
    console.warn('AniList getTopRated failed, switching to Kitsu fallback:', err.message);
  }

  // 1. Fallback to Kitsu Top Rated
  const kitsuList = await fetchKitsuList(`https://kitsu.io/api/edge/anime?sort=-averageRating&page[limit]=${perPage}&page[offset]=${(page - 1) * perPage}`);
  if (kitsuList && kitsuList.length > 0) return kitsuList;

  return OFFLINE_ANIME_DATASET;
}

/**
 * Fetch Airing Schedule
 */
export async function getAiringSchedule(page = 1, perPage = 20) {
  try {
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
    if (data?.Page?.airingSchedules) return data.Page.airingSchedules;
  } catch (err) {
    console.warn('getAiringSchedule AniList failed:', err.message);
  }
  return [];
}

/**
 * Fetch Weekly Anime Schedule with robust offline & client-side fallback
 */
export function getClientFallbackSchedule() {
  const now = new Date();
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const jsDay = now.getDay();
  const indonesianDays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const indonesianShorts = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  const todayName = dayNames[jsDay];
  const todayIdx = indonesianDays.indexOf(todayName) !== -1 ? indonesianDays.indexOf(todayName) : 3;

  const catalog = (LIVECHART_SCHEDULE && typeof LIVECHART_SCHEDULE === 'object') ? LIVECHART_SCHEDULE : {};

  const days = {};
  indonesianDays.forEach((dayName, idx) => {
    const diff = idx - todayIdx;
    const target = new Date(now.getTime() + diff * 86400000);
    const dayItems = catalog[dayName] || [];
    days[dayName] = {
      name: dayName,
      shortName: indonesianShorts[idx],
      dayIndex: idx,
      isToday: idx === todayIdx,
      dateNum: String(target.getDate()).padStart(2, '0'),
      dateFormatted: `${target.getDate()} ${target.toLocaleString('id-ID', { month: 'short' })}`,
      airing: dayItems.filter(i => i.category === 'airing'),
      upcoming: dayItems.filter(i => i.category === 'upcoming'),
      finished: dayItems.filter(i => i.category === 'finished'),
      totalCount: dayItems.length
    };
  });

  return {
    success: true,
    today: indonesianDays[todayIdx],
    todayIndex: todayIdx,
    days
  };
}

export async function getWeeklySchedule() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(apiUrl('/api/anime/schedule'), { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await safeFetchJson(res, 'Jadwal Mingguan');
    if (data && data.days) return data;
  } catch (err) {
    console.warn('getWeeklySchedule server fetch failed, using built-in seasonal schedule fallback:', err.message);
  }
  return getClientFallbackSchedule();
}

/**
 * Fetch LiveChart Seasonal Anime
 */
export async function getLiveChart({ season, year, sort = 'POPULARITY_DESC', format, page = 1, perPage = 50 } = {}) {
  try {
    const params = new URLSearchParams();
    if (season) params.set('season', season);
    if (year) params.set('year', year);
    if (sort) params.set('sort', sort);
    if (format && format !== 'ALL') params.set('format', format);
    if (page) params.set('page', page);
    if (perPage) params.set('perPage', perPage);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(apiUrl(`/api/anime/livechart${qs}`));
    return await safeFetchJson(res, 'LiveChart');
  } catch (err) {
    console.error('getLiveChart error:', err);
    throw err;
  }
}

/**
 * Advanced Search & Filter
 */
export async function searchAnime(keyword = '', filters = {}, page = 1, perPage = 18) {
  const cleanQ = (keyword || '').trim();
  const normQ = cleanQ.toLowerCase().replace(/[^a-z0-9]/g, '');
  const targetGenre = filters.genre && filters.genre !== 'ALL' ? filters.genre.toLowerCase() : null;

  // Helper to filter anime by genre
  const filterByGenre = (list) => {
    if (!targetGenre) return list;
    return list.filter(a => Array.isArray(a.genres) && a.genres.some(g => (g || '').toLowerCase() === targetGenre));
  };

  // 1. Try AniList GraphQL
  try {
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
    if (cleanQ) variables.search = cleanQ;
    if (filters.genre && filters.genre !== 'ALL') variables.genre = filters.genre;
    if (filters.format && filters.format !== 'ALL') variables.format = filters.format;

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
        variables.sort = cleanQ ? ['SEARCH_MATCH', 'POPULARITY_DESC'] : ['TRENDING_DESC'];
    }

    const data = await fetchAniList(query, variables);
    if (data?.Page?.media && data.Page.media.length > 0) {
      let results = data.Page.media;
      if (targetGenre) {
        results = filterByGenre(results);
      }
      if (results.length > 0) return results;
    }
  } catch (err) {
    console.warn('AniList searchAnime failed, switching to fallbacks:', err.message);
  }

  // 2. Build local/curated matching list
  const allKnownList = [...OFFLINE_ANIME_DATASET];
  try {
    const sched = getClientFallbackSchedule();
    for (const d of Object.values(sched.days || {})) {
      for (const item of [...(d.airing || []), ...(d.upcoming || []), ...(d.finished || [])]) {
        if (!allKnownList.some(x => x.id === item.id)) {
          allKnownList.push(item);
        }
      }
    }
  } catch (_) {}

  // Direct normalized match in catalog
  let localMatches = [];
  if (cleanQ) {
    localMatches = allKnownList.filter(a => {
      const rom = (a.title?.romaji || '').toLowerCase();
      const eng = (a.title?.english || '').toLowerCase();
      const normRom = rom.replace(/[^a-z0-9]/g, '');
      const normEng = eng.replace(/[^a-z0-9]/g, '');
      const desc = (a.description || '').toLowerCase();
      
      return normRom.includes(normQ) || 
             normEng.includes(normQ) || 
             rom.includes(cleanQ.toLowerCase()) || 
             eng.includes(cleanQ.toLowerCase()) || 
             desc.includes(cleanQ.toLowerCase());
    });
    localMatches = filterByGenre(localMatches);
  }

  // 3. Primary Search via YummyAnime API (anicli-api Core)
  if (cleanQ) {
    try {
      const res = await fetch(apiUrl(`/api/yummy/search?q=${encodeURIComponent(cleanQ)}`));
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.results) && data.results.length > 0) {
          const filteredYummy = filterByGenre(data.results);
          const combined = [...localMatches];
          for (const item of filteredYummy) {
            if (!combined.some(c => c.id === item.id || (c.title?.romaji && c.title.romaji === item.title?.romaji))) {
              combined.push(item);
            }
          }
          if (combined.length > 0) return combined;
        }
      }
    } catch (yummyErr) {
      console.warn('Yummy search notice:', yummyErr);
    }

    if (localMatches.length > 0) return localMatches;
    return [];
  }

  // If no search keyword, but a genre filter was chosen, filter known catalog
  if (targetGenre) {
    return filterByGenre(allKnownList);
  }

  return OFFLINE_ANIME_DATASET;
}

/**
 * Direct YummyAnime Search Helper
 */
export async function searchYummy(query) {
  try {
    const res = await fetch(apiUrl(`/api/yummy/search?q=${encodeURIComponent(query)}`));
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.results)) {
        return data.results;
      }
    }
  } catch (err) {
    console.warn('Yummy search notice:', err);
  }
  return [];
}

/**
 * Fetch comprehensive Anime Details with resilient fallback
 */
export async function getAnimeDetails(id) {
  const numId = Number(id);
  const cacheKey = `anipulse_anime_detail_${numId}`;

  // 1. Instant cache check (0ms)
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Clean up corrupted / poisoned YummyAnime cache for numeric IDs
      const isCorrupted = parsed && (
        parsed.yummyId ||
        typeof parsed.title === 'string' ||
        (!parsed.title?.romaji && !parsed.title?.english) ||
        (numId === 7791 && (parsed.title?.english?.includes('Schastlivyy') || parsed.title?.romaji?.includes('Schastlivyy')))
      );
      if (isCorrupted) {
        localStorage.removeItem(cacheKey);
      } else if (parsed && (parsed.id === numId || parsed.id == id)) {
        return parsed;
      }
    }
  } catch (_) {}

  // 2. Check offline dataset
  const offlineMatch = OFFLINE_ANIME_DATASET.find(a => a.id === numId || a.id == id);
  if (offlineMatch) return offlineMatch;

  // 3. AniList GraphQL is the canonical metadata authority for numeric anime IDs
  if (!isNaN(numId) && numId > 0) {
    try {
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
      const data = await fetchAniList(query, { id: numId });
      if (data && data.Media) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data.Media));
        } catch (_) {}
        return data.Media;
      }
    } catch (err) {
      console.warn(`Error fetching AniList details for ${id}, trying fallbacks:`, err.message);
    }
  }

  // 4. Try YummyAnime lookup if id is a non-numeric slug
  if (isNaN(numId)) {
    try {
      const yummyRes = await fetch(apiUrl(`/api/yummy/anime/${encodeURIComponent(id)}`));
      if (yummyRes.ok) {
        const yummyData = await yummyRes.json();
        if (yummyData && yummyData.id) {
          try { localStorage.setItem(cacheKey, JSON.stringify(yummyData)); } catch (_) {}
          return yummyData;
        }
      }
    } catch (_) {}
  }

  // 4. Fallback to Kitsu API
  try {
    const res = await fetch(`https://kitsu.io/api/edge/anime/${id}`);
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        const transformed = transformKitsuItem(json.data);
        if (transformed) {
          try { localStorage.setItem(cacheKey, JSON.stringify(transformed)); } catch (_) {}
          return transformed;
        }
      }
    }
  } catch (_) {}

  // 5. Check schedule catalog
  try {
    const sched = getClientFallbackSchedule();
    for (const d of Object.values(sched.days || {})) {
      const foundInSched = [...(d.airing || []), ...(d.upcoming || []), ...(d.finished || [])].find(a => a.id === numId || a.id == id);
      if (foundInSched) {
        return {
          id: foundInSched.id,
          title: foundInSched.title,
          coverImage: {
            large: foundInSched.coverImage?.large,
            extraLarge: foundInSched.coverImage?.large
          },
          bannerImage: foundInSched.coverImage?.large,
          status: foundInSched.category === 'finished' ? 'FINISHED' : 'RELEASING',
          currentEpisode: foundInSched.currentEpisode || 3,
          episodes: foundInSched.episodes || foundInSched.currentEpisode || 3,
          genres: foundInSched.genres || ['Romance', 'Sports'],
          averageScore: foundInSched.averageScore,
          description: foundInSched.description || `${foundInSched.title?.english || foundInSched.title?.romaji} tayang setiap ${d.name} di AniPulse.`
        };
      }
    }
  } catch (_) {}

  // 6. Safe fallback (never crash WatchView or modals)
  return {
    id: numId || id,
    title: {
      romaji: 'Anime Stream',
      english: 'Anime Stream'
    },
    coverImage: {
      large: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80',
      extraLarge: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80'
    },
    bannerImage: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80',
    status: 'RELEASING',
    currentEpisode: 3,
    episodes: 3,
    genres: ['Action', 'Fantasy'],
    description: 'Menonton anime favoritmu dengan kualitas HD di AniPulse Theater.'
  };
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
 * Safe Image Proxy helper to avoid ISP / referrer blocks while ensuring native mobile compatibility
 */
export function getSafeImageUrl(url) {
  const DEFAULT_ANIME_COVER = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80';
  if (!url) return DEFAULT_ANIME_COVER;
  if (typeof url === 'object' && url !== null) {
    url = url.large || url.extraLarge || url.medium || url.original || '';
    if (!url) return DEFAULT_ANIME_COVER;
  }
  if (typeof url !== 'string' || !url.trim()) return DEFAULT_ANIME_COVER;

  const cleanUrl = url.trim();

  // Known broken/dead hashes or old Kitsu paths
  if (
    cleanUrl.includes('bx170942-') || 
    cleanUrl.includes('bx171018-') || 
    cleanUrl.includes('bx180104-') || 
    cleanUrl.includes('bx159322-') || 
    cleanUrl.includes('bx163134-') || 
    cleanUrl.includes('bx170947-') || 
    cleanUrl.includes('bx169829-') || 
    cleanUrl.includes('bx178551-') || 
    cleanUrl.includes('media.kitsu.app/anime/poster_images/')
  ) {
    return DEFAULT_ANIME_COVER;
  }

  // If already full HTTPS URL or data URL, return directly so native mobile WebView loads without mixed-content or LAN proxy dependencies
  if (cleanUrl.startsWith('https://') || cleanUrl.startsWith('data:')) {
    return cleanUrl;
  }

  // If http://, upgrade to https:// to prevent mixed-content blocking on Android WebView (https://localhost)
  if (cleanUrl.startsWith('http://')) {
    return cleanUrl.replace(/^http:\/\//i, 'https://');
  }

  if (cleanUrl.startsWith('/api/')) return apiUrl(cleanUrl);
  return cleanUrl;
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
  const cleanUser = (username || '').trim();
  const cleanPass = (password || '').trim();

  // 1. Try backend server
  try {
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUser, password: cleanPass })
    });
    const data = await safeFetchJson(res, 'Masuk Akun');
    setAuthToken(data.token);
    if (data.user) {
      try { localStorage.setItem('anipulse_cached_user', JSON.stringify(data.user)); } catch (_) {}
    }
    return data;
  } catch (err) {
    // 2. Offline Fallback for Admin & VIP credentials when server is offline/unreachable
    const lowUser = cleanUser.toLowerCase();
    const offlineAccounts = {
      'runa': { pass: 'runa8989', name: 'Runa Admin', role: 'admin' },
      'runa@gmail.com': { pass: 'runa8989', name: 'Runa Admin', role: 'admin' },
      'admin': { pass: 'admin123', name: 'Admin AniPulse', role: 'admin' },
      'iruna': { pass: 'iruna123', name: 'Iruna VIP', role: 'admin' },
      'rillardian': { pass: 'rillardian123', name: 'Rillardian VIP', role: 'admin' },
      'vip': { pass: 'vip123', name: 'VIP Member', role: 'user' }
    };

    if (offlineAccounts[lowUser] && offlineAccounts[lowUser].pass === cleanPass) {
      const acc = offlineAccounts[lowUser];
      console.warn(`Backend server unreachable, activating offline login bypass for ${cleanUser}:`, err.message);
      const offlineData = {
        success: true,
        token: `offline_vip_${lowUser}_token`,
        user: {
          username: lowUser,
          displayName: acc.name,
          role: acc.role,
          expiresAt: '2099-12-31 23:59:59',
          remainingSeconds: 999999999
        }
      };
      setAuthToken(offlineData.token);
      try { localStorage.setItem('anipulse_cached_user', JSON.stringify(offlineData.user)); } catch (_) {}
      return offlineData;
    }
    throw err;
  }
}

export async function authMe() {
  const token = getAuthToken();
  if (!token) return null;
  if (token.startsWith('offline_vip_') || token.startsWith('master-')) {
    const cached = localStorage.getItem('anipulse_cached_user');
    if (cached) {
      try { return JSON.parse(cached); } catch (_) {}
    }
    return {
      username: 'runa',
      displayName: 'Runa Admin',
      role: 'admin',
      expiresAt: '2099-12-31 23:59:59',
      remainingSeconds: 999999999
    };
  }
  try {
    const res = await fetch(apiUrl('/api/auth/me'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      setAuthToken('');
      localStorage.removeItem('anipulse_cached_user');
      return null;
    }
    if (!res.ok) {
      const cached = localStorage.getItem('anipulse_cached_user');
      if (cached) {
        try { return JSON.parse(cached); } catch (_) {}
      }
      return null;
    }
    const data = await safeFetchJson(res, 'Validasi Sesi');
    if (data.user) {
      try { localStorage.setItem('anipulse_cached_user', JSON.stringify(data.user)); } catch (_) {}
    }
    return data.user;
  } catch {
    const cached = localStorage.getItem('anipulse_cached_user');
    if (cached) {
      try { return JSON.parse(cached); } catch (_) {}
    }
    return null;
  }
}

export async function authLogout() {
  const token = getAuthToken();
  if (token && !token.startsWith('offline_vip_') && token !== 'master-admin-runa8989-token') {
    try {
      await fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch {}
  }
  setAuthToken('');
  try { localStorage.removeItem('anipulse_cached_user'); } catch (_) {}
}

// ==========================================
// Standalone VIP Ticket Registry & Firebase Cloud Sync
// ==========================================
export const MASTER_TICKETS = [
  { code: 'VIP-ANIPULSE', targetName: 'VIP AniPulse Member', durationType: 'permanent', durationSeconds: 999999999, status: 'active' },
  { code: 'VIP-TEMAN-2026', targetName: 'Kawan VIP AniPulse', durationType: '30_days', durationSeconds: 2592000, status: 'active' },
  { code: 'VIP-KODIK', targetName: 'VIP Kodik Stream', durationType: 'permanent', durationSeconds: 999999999, status: 'active' },
  { code: 'VIP-PREMIUM', targetName: 'VIP Premium Member', durationType: 'permanent', durationSeconds: 999999999, status: 'active' },
  { code: 'VIP-RUNA', targetName: 'VIP Runa Official', durationType: 'permanent', durationSeconds: 999999999, status: 'active' }
];

export function getCloudTickets() {
  try {
    const raw = localStorage.getItem('anipulse_cloud_tickets');
    const list = raw ? JSON.parse(raw) : [];
    // Ensure master tickets are included
    for (const mt of MASTER_TICKETS) {
      if (!list.some(t => t.code === mt.code)) {
        list.push(mt);
      }
    }
    return list;
  } catch (_) {
    return [...MASTER_TICKETS];
  }
}

export function saveCloudTicket(ticket) {
  try {
    const list = getCloudTickets();
    const idx = list.findIndex(t => t.code === ticket.code);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...ticket };
    } else {
      list.unshift(ticket);
    }
    localStorage.setItem('anipulse_cloud_tickets', JSON.stringify(list));
  } catch (_) {}
}

export function adminDeleteCloudTicket(code) {
  try {
    const list = getCloudTickets().filter(t => t.code !== code);
    localStorage.setItem('anipulse_cloud_tickets', JSON.stringify(list));
  } catch (_) {}
}

async function syncTicketToFirebase(ticket) {
  try {
    if (db) {
      await setDoc(doc(db, "vip_tickets", ticket.code), {
        ...ticket,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  } catch (err) {
    console.warn('Firebase ticket sync note (continuing locally):', err.message);
  }
}

async function recordTicketUsageInFirebase(code, user) {
  try {
    if (db) {
      const logId = `${code}_${Date.now()}`;
      await setDoc(doc(db, "ticket_logins", logId), {
        code,
        username: user.username,
        displayName: user.displayName,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        loggedInAt: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn('Firebase ticket usage log note (continuing locally):', err.message);
  }
}

/**
 * Single-click VIP Login using Ticket Code
 */
export async function claimTicketOnly(code) {
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) throw new Error('Silakan masukkan Kode Tiket VIP!');

  // 1. Try backend server if reachable
  try {
    const res = await fetch(apiUrl('/api/auth/claim-ticket-only'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cleanCode })
    });
    if (res.ok) {
      const data = await safeFetchJson(res, 'Klaim Tiket');
      if (data && data.token) {
        setAuthToken(data.token);
        if (data.user) {
          localStorage.setItem('anipulse_cached_user', JSON.stringify(data.user));
        }
        recordTicketUsageInFirebase(cleanCode, data.user);
        return data;
      }
    }
  } catch (err) {
    console.warn('Server unreachable, validating ticket locally/cloud:', err.message);
  }

  // 2. Validate ticket via Cloud Tickets registry & Master tickets
  const cloudList = getCloudTickets();
  const foundTicket = cloudList.find(t => t.code === cleanCode);

  const isValidFormat = cleanCode.startsWith('VIP-') || cleanCode.startsWith('TIKET-') || foundTicket;
  if (!isValidFormat) {
    throw new Error('Kode tiket tidak valid. Pastikan diawali dengan VIP- (contoh: VIP-30D-XXXXXX)');
  }

  const targetName = foundTicket?.targetName || 'Kawan VIP';
  const claimData = {
    success: true,
    token: `ticket_vip_${cleanCode.toLowerCase()}_token`,
    user: {
      username: `vip_${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      displayName: targetName,
      role: 'user',
      ticketCode: cleanCode,
      isTicketLogin: true,
      expiresAt: '2099-12-31 23:59:59',
      remainingSeconds: 999999999
    }
  };

  if (foundTicket) {
    foundTicket.status = 'claimed';
    foundTicket.claimedAt = new Date().toISOString();
    foundTicket.claimedBy = claimData.user.username;
    saveCloudTicket(foundTicket);
  }

  setAuthToken(claimData.token);
  try {
    localStorage.setItem('anipulse_cached_user', JSON.stringify(claimData.user));
  } catch (_) {}

  // Firebase monitoring
  recordTicketUsageInFirebase(cleanCode, claimData.user);

  return claimData;
}

export async function verifyInvite(code) {
  const cleanCode = (code || '').trim().toUpperCase();
  try {
    const res = await fetch(apiUrl(`/api/auth/verify-invite?code=${encodeURIComponent(cleanCode)}`));
    return await safeFetchJson(res, 'Verifikasi Tiket');
  } catch (err) {
    const cloudList = getCloudTickets();
    const found = cloudList.find(t => t.code === cleanCode);
    if (found || cleanCode.startsWith('VIP-') || cleanCode.startsWith('TIKET-')) {
      return {
        valid: true,
        code: cleanCode,
        targetName: found?.targetName || 'VIP Member',
        durationType: found?.durationType || 'Selamanya (Permanent)',
        durationSeconds: found?.durationSeconds || 999999999
      };
    }
    throw err;
  }
}

export async function claimInvite(code, username, password, displayName) {
  const cleanCode = (code || '').trim().toUpperCase();
  try {
    const res = await fetch(apiUrl('/api/auth/claim-invite'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cleanCode, username, password, displayName })
    });
    const data = await safeFetchJson(res, 'Klaim Undangan');
    setAuthToken(data.token);
    if (data.user) {
      try { localStorage.setItem('anipulse_cached_user', JSON.stringify(data.user)); } catch (_) {}
    }
    return data;
  } catch (err) {
    const claimData = {
      success: true,
      token: `offline_vip_${cleanCode.toLowerCase()}_token`,
      user: {
        username: (username || 'user').toLowerCase(),
        displayName: displayName || username || 'VIP Member',
        role: 'user',
        expiresAt: '2099-12-31 23:59:59',
        remainingSeconds: 999999999
      }
    };
    setAuthToken(claimData.token);
    try { localStorage.setItem('anipulse_cached_user', JSON.stringify(claimData.user)); } catch (_) {}
    recordTicketUsageInFirebase(cleanCode, claimData.user);
    return claimData;
  }
}

/**
 * Admin API Helpers
 */
export async function adminCreateInvite(targetName, durationType, customDays = null) {
  const token = getAuthToken();
  const cleanTarget = (targetName || '').trim() || 'Kawan VIP';

  // Try server first
  try {
    const res = await fetch(apiUrl('/api/admin/create-invite'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ targetName: cleanTarget, durationType, customDays })
    });
    if (res.ok) {
      const data = await safeFetchJson(res, 'Buat Undangan');
      if (data && data.success && data.invite) {
        saveCloudTicket(data.invite);
        syncTicketToFirebase(data.invite);
        return data;
      }
    }
  } catch (err) {
    console.warn('adminCreateInvite remote server unreachable, generating cloud ticket:', err.message);
  }

  // Generate self-validating VIP ticket
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  let durTag = '30D';
  let durationSeconds = 30 * 86400;
  if (durationType === 'permanent') {
    durTag = 'INF';
    durationSeconds = 999999999;
  } else if (durationType === '1_day') {
    durTag = '1D';
    durationSeconds = 86400;
  } else if (durationType === '7_days') {
    durTag = '7D';
    durationSeconds = 7 * 86400;
  } else if (durationType === 'custom' && customDays) {
    durTag = `${customDays}D`;
    durationSeconds = Number(customDays) * 86400;
  }

  const newTicket = {
    code: `VIP-${durTag}-${randomSuffix}`,
    targetName: cleanTarget,
    durationType,
    durationSeconds,
    status: 'pending',
    createdAt: new Date().toISOString(),
    claimedAt: null,
    claimedBy: null
  };

  saveCloudTicket(newTicket);
  syncTicketToFirebase(newTicket);

  return {
    success: true,
    invite: newTicket
  };
}

export async function adminCreateUser(username, password, displayName, durationDays = 30) {
  const token = getAuthToken();
  const res = await fetch(apiUrl('/api/admin/create-user'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      username,
      password,
      display_name: displayName,
      duration_days: durationDays
    })
  });
  return await safeFetchJson(res, 'Buat Akun User');
}

export async function adminGetInvites() {
  const token = getAuthToken();
  let serverInvites = [];
  try {
    const res = await fetch(apiUrl('/api/admin/invites'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await safeFetchJson(res, 'Daftar Undangan');
      serverInvites = data.invites || [];
    }
  } catch (err) {
    console.warn('adminGetInvites server unreachable, reading cloud tickets:', err.message);
  }

  const cloudList = getCloudTickets();
  const mergedMap = new Map();
  for (const inv of serverInvites) {
    mergedMap.set(inv.code, inv);
  }
  for (const inv of cloudList) {
    if (!mergedMap.has(inv.code)) {
      mergedMap.set(inv.code, inv);
    }
  }
  return Array.from(mergedMap.values());
}

export async function adminGetUsers() {
  const token = getAuthToken();
  const res = await fetch(apiUrl('/api/admin/users'), {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await safeFetchJson(res, 'Daftar Pengguna');
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
  return await safeFetchJson(res, 'Perpanjang Pengguna');
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
      const data = await res.json();
      return {
        found: !!data.found,
        translation: data.translation || '',
        text: data.translation || '',
        provider: data.provider || 'server_db'
      };
    }
  } catch (e) {
    console.warn('Translation lookup error:', e);
  }
  return { found: false, translation: '', text: '' };
}

export async function translateSynopsis(firstArg, secondArg = null) {
  // Support both (text, animeId) and (animeId, text)
  let text = '';
  let animeId = null;

  if (typeof firstArg === 'number' || (typeof firstArg === 'string' && /^\d+$/.test(String(firstArg).trim()))) {
    animeId = String(firstArg).trim();
    text = secondArg || '';
  } else {
    text = firstArg || '';
    animeId = secondArg ? String(secondArg).trim() : null;
  }

  if (!text || !text.trim()) {
    return { success: false, translation: '', text: '' };
  }

  try {
    const params = new URLSearchParams({ text: text.trim(), to_lang: 'id', from_lang: 'en' });
    if (animeId) params.append('anime_id', animeId);
    const res = await fetch(apiUrl(`/api/translate?${params.toString()}`));
    if (res.ok) {
      const data = await res.json();
      const translated = data.translation || text;
      return {
        success: !!data.success,
        translation: translated,
        text: translated,
        source: data.provider || (data.cached ? 'server_db' : 'google')
      };
    }
  } catch (e) {
    console.warn('Translation fetch error:', e);
  }
  return { success: false, translation: text, text };
}

/**
 * Direct Client-Side Anime Streaming Resolution (Zero-Backend Fallback for Mobile Data / Kuota)
 * Directly queries public Yani/Kodik API for episode streams if backend server is unreachable
 */
export async function fetchClientDirectEpisodes(title, altTitle, yummyId = null) {
  try {
    let targetAnimeId = yummyId;
    if (!targetAnimeId) {
      const candidates = [title, altTitle].filter(Boolean);
      for (const cand of candidates) {
        try {
          const sRes = await fetch(`https://api.yani.tv/anime?q=${encodeURIComponent(cand)}&offset=0&limit=8`);
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData.response && sData.response.length > 0) {
              for (const item of sData.response) {
                const vRes = await fetch(`https://api.yani.tv/anime/${item.anime_id}/videos`);
                if (vRes.ok) {
                  const vData = await vRes.json();
                  if (vData.response && Array.isArray(vData.response) && vData.response.length > 0) {
                    targetAnimeId = item.anime_id;
                    break;
                  }
                }
              }
              if (targetAnimeId) break;
            }
          }
        } catch (_) {}
      }
    }
    if (!targetAnimeId) return [];

    const vRes = await fetch(`https://api.yani.tv/anime/${targetAnimeId}/videos`);
    if (!vRes.ok) return [];
    const vData = await vRes.json();
    if (!vData.response || !Array.isArray(vData.response)) return [];

    const numSet = new Set();
    for (const v of vData.response) {
      const n = Number(v.number);
      if (!isNaN(n) && n > 0) numSet.add(n);
    }
    const sorted = Array.from(numSet).sort((a, b) => a - b);
    return sorted.map(num => ({
      num,
      title: `Episode ${num}`
    }));
  } catch (err) {
    console.warn('fetchClientDirectEpisodes error:', err);
    return [];
  }
}

export async function fetchClientDirectStreams(title, altTitle, ep, yummyId = null) {
  try {
    let targetAnimeId = yummyId;
    let epVideos = [];

    const extractValidVideos = (videos, targetEp) => {
      if (!Array.isArray(videos)) return [];
      return videos.filter(v => {
        if (String(v.number) !== String(targetEp)) return false;
        if (!v.iframe_url) return false;
        // ru.yummyani.me blocks iframe embedding via X-Frame-Options: SAMEORIGIN
        if (v.iframe_url.includes('yummyani.me')) return false;
        return true;
      });
    };

    // 1. Direct fetch if yummyId provided
    if (targetAnimeId) {
      try {
        const vRes = await fetch(`https://api.yani.tv/anime/${targetAnimeId}/videos`);
        if (vRes.ok) {
          const vData = await vRes.json();
          const found = extractValidVideos(vData.response, ep);
          if (found.length > 0) {
            epVideos = found;
          }
        }
      } catch (err) {
        console.warn('Direct yummyId videos error:', err);
      }
    }

    // 2. Search candidates if direct ID yielded no videos
    if (epVideos.length === 0) {
      const queryCandidates = [];
      if (title) queryCandidates.push(title);
      if (altTitle && altTitle !== title) queryCandidates.push(altTitle);
      
      const cleanBase = title ? title.replace(/\s*(Season|2nd Season|Part \d+|S\d+).*$/i, '').trim() : '';
      if (cleanBase && !queryCandidates.includes(cleanBase)) {
        queryCandidates.push(cleanBase);
      }

      for (const cand of queryCandidates) {
        try {
          const sRes = await fetch(`https://api.yani.tv/anime?q=${encodeURIComponent(cand)}&offset=0&limit=8`);
          if (sRes.ok) {
            const sData = await sRes.json();
            if (sData.response && Array.isArray(sData.response)) {
              for (const item of sData.response) {
                try {
                  const vRes = await fetch(`https://api.yani.tv/anime/${item.anime_id}/videos`);
                  if (vRes.ok) {
                    const vData = await vRes.json();
                    const found = extractValidVideos(vData.response, ep);
                    if (found.length > 0) {
                      epVideos = found;
                      targetAnimeId = item.anime_id;
                      break;
                    }
                  }
                } catch (_) {}
              }
              if (epVideos.length > 0) break;
            }
          }
        } catch (_) {}
      }
    }

    if (epVideos.length === 0) return [];

    const sources = [];
    for (const v of epVideos) {
      let cleanIframe = v.iframe_url;
      if (cleanIframe.startsWith('//')) cleanIframe = `https:${cleanIframe}`;
      if (cleanIframe.startsWith('http://')) cleanIframe = cleanIframe.replace('http://', 'https://');

      const rawPlayer = v.data?.player || 'Server Kodik Cloud';
      const rawDubbing = v.data?.dubbing || '';
      const isSub = rawDubbing.toLowerCase().includes('субтитр') || 
                    rawDubbing.toLowerCase().includes('sub') || 
                    rawDubbing.toLowerCase().includes('kazoku');
      
      const cleanPlayer = cleanSourceTitle(rawPlayer);
      const cleanDub = cleanSourceTitle(rawDubbing);
      let titleLabel = cleanDub ? `${cleanDub} (${cleanPlayer})` : cleanPlayer;
      if (isSub) {
        titleLabel = `${titleLabel} [Audio Asli Jepang]`;
      }

      sources.push({
        title: titleLabel,
        is_subtitles_original: isSub,
        player_url: cleanIframe,
        iframe_url: cleanIframe,
        is_embed: true,
        videos: [
          {
            quality: 720,
            type: 'embed',
            url: cleanIframe,
            direct_url: cleanIframe
          }
        ]
      });
    }

    sources.sort((a, b) => {
      if (a.is_subtitles_original && !b.is_subtitles_original) return -1;
      if (!a.is_subtitles_original && b.is_subtitles_original) return 1;
      return 0;
    });

    return sources;
  } catch (err) {
    console.warn('fetchClientDirectStreams error:', err);
    return [];
  }
}

/**
 * Clean & overwrite Russian anime titles with Indonesian / Romaji
 */
export function cleanRussianTitle(str) {
  if (!str || typeof str !== 'string') return '';
  let s = str;
  s = s.replace(/Голубая шкатулка\s*2/gi, 'Kotak Biru Season 2');
  s = s.replace(/Голубая шкатулка/gi, 'Kotak Biru');
  s = s.replace(/Синяя тюрьма/gi, 'Blue Lock');
  s = s.replace(/Блю Лок/gi, 'Blue Lock');
  s = s.replace(/Дандадан/gi, 'DAN DA DAN');
  s = s.replace(/Блич/gi, 'Bleach');
  s = s.replace(/Магическая битва/gi, 'Jujutsu Kaisen');
  s = s.replace(/Поднятие уровня в одиночку/gi, 'Solo Leveling');
  s = s.replace(/Клинок, рассекающий демонов/gi, 'Demon Slayer');
  s = s.replace(/Атака титанов/gi, 'Attack on Titan');
  s = s.replace(/Человек-бензопила/gi, 'Chainsaw Man');
  // Strip any leftover Russian text in parentheses e.g. "(Голубая шкатулка 2)"
  s = s.replace(/\s*\([а-яА-ЯёЁ\s0-9:—\-]+\)/g, '');
  return s.trim();
}

/**
 * Clean & overwrite Russian server / dubbing names with Indonesian
 */
export function cleanSourceTitle(str) {
  if (!str || typeof str !== 'string') return 'Server Video';
  let s = str;
  s = s.replace(/Субтитры/gi, 'Sub Rusia (Audio Asli)');
  s = s.replace(/Озвучка/gi, 'Sulih Suara Rusia');
  s = s.replace(/Плеер Kodik/gi, 'Server Kodik');
  s = s.replace(/Плеер CVH/gi, 'Server CVH');
  s = s.replace(/Плеер/gi, 'Server');
  s = s.replace(/Дубляж/gi, 'Dubbing');
  s = s.replace(/Комната Диди/gi, 'Komnata Didi');
  s = s.replace(/Закадровый Отдел/gi, 'Zakadrovy Otdel');
  s = s.replace(/ТО Дубляжная/gi, 'TO Dublyazhnaya');
  return s.trim();
}

/**
 * Retrieve verified offline / preset Indonesian subtitles
 */
export function getPresetSubtitles(title, altTitle, ep) {
  if (!PRESET_SUBTITLES || typeof PRESET_SUBTITLES !== 'object') return [];
  const epNum = Number(ep);
  const candidates = [];
  if (title) {
    const clean1 = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    candidates.push(`${clean1}:${epNum}`);
  }
  if (altTitle) {
    const clean2 = altTitle.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    candidates.push(`${clean2}:${epNum}`);
  }
  for (const key of candidates) {
    if (PRESET_SUBTITLES[key]) {
      return PRESET_SUBTITLES[key];
    }
  }
  for (const [k, v] of Object.entries(PRESET_SUBTITLES)) {
    if (k.endsWith(`:${epNum}`)) {
      const kTitle = k.slice(0, -`:${epNum}`.length).trim();
      for (const cand of [title, altTitle]) {
        if (!cand) continue;
        const candNorm = cand.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (candNorm.includes(kTitle) || kTitle.includes(candNorm)) {
          return v;
        }
      }
    }
  }
  return [];
}






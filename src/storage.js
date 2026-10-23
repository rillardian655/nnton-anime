// ==========================================
// AniPulse - Local Storage Management
// Watchlist, History, Favorites, Settings
// ==========================================

const WATCHLIST_KEY = 'anipulse_watchlist_v1';
const HISTORY_KEY = 'anipulse_history_v1';
const FAVORITES_KEY = 'anipulse_favorites_v1';

export function getWatchlist() {
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to get watchlist:', e);
    return [];
  }
}

export function saveWatchlist(list) {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save watchlist:', e);
  }
}

export function addToWatchlist(anime, status = 'WATCHING') {
  const list = getWatchlist();
  const index = list.findIndex(item => item.id === anime.id);
  const entry = {
    id: anime.id,
    title: anime.title?.english || anime.title?.romaji || 'Unknown Anime',
    coverImage: anime.coverImage?.large || anime.coverImage?.extraLarge,
    episodes: anime.episodes,
    averageScore: anime.averageScore,
    status: status, // 'WATCHING', 'PLAN', 'COMPLETED'
    updatedAt: Date.now()
  };

  if (index >= 0) {
    list[index] = { ...list[index], ...entry };
  } else {
    list.unshift(entry);
  }
  saveWatchlist(list);
  return entry;
}

export function removeFromWatchlist(id) {
  const list = getWatchlist().filter(item => item.id !== Number(id));
  saveWatchlist(list);
}

export function getWatchlistStatus(id) {
  const list = getWatchlist();
  const item = list.find(it => it.id === Number(id));
  return item ? item.status : null;
}

// ================= History & Continue Watching =================

export function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const CANONICAL_COVERS = {
  7791: 'https://cdn.myanimelist.net/images/anime/12/76121.jpg', // K-ON! Season 2
  5680: 'https://cdn.myanimelist.net/images/anime/10/76120.jpg', // K-ON! Season 1
  170942: 'https://cdn.myanimelist.net/images/anime/1066/145455.jpg', // Blue Box
  19655: 'https://cdn.myanimelist.net/images/anime/1066/145455.jpg', // Blue Box S2
  171018: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx171018-60q1B6GK2Ghb.jpg', // Dandadan
  151807: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-it355ZgzquUd.png', // Solo Leveling
  154587: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg', // Frieren
  127230: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-DdP4vAdssLoz.png', // Chainsaw Man
  113415: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-LHBAeoZDIsnF.jpg', // Jujutsu Kaisen
  101922: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0ClmgYL.jpg', // Demon Slayer
  16498: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg', // Attack on Titan
  21: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-ELSYx3yMPcKM.jpg', // One Piece
};

function resolveRealCover(animeId, candidateCover, currentHistoryItem = null, title = '') {
  const isBad = (u) => !u || typeof u !== 'string' || u.includes('photo-1578632767115-351597cf2477') || u.includes('placeholder');
  
  if (!isBad(candidateCover)) return candidateCover;

  if (currentHistoryItem && !isBad(currentHistoryItem.coverImage)) {
    return currentHistoryItem.coverImage;
  }

  const numId = Number(animeId);
  if (CANONICAL_COVERS[numId]) return CANONICAL_COVERS[numId];

  const tLower = (title || '').toLowerCase();
  if (tLower.includes('k-on') || tLower.includes('keion')) {
    return (tLower.includes('season 2') || tLower.includes('!!') || tLower.includes('s2') || tLower.includes(' 2'))
      ? CANONICAL_COVERS[7791]
      : CANONICAL_COVERS[5680];
  }
  if (tLower.includes('blue box') || tLower.includes('ao no hako') || tLower.includes('kotak biru')) {
    return CANONICAL_COVERS[170942];
  }
  if (tLower.includes('solo leveling') || tLower.includes('ore dake level up')) {
    return CANONICAL_COVERS[151807];
  }
  if (tLower.includes('dandadan')) {
    return CANONICAL_COVERS[171018];
  }

  return 'https://cdn.myanimelist.net/images/anime/12/76121.jpg';
}

export function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    let modified = false;
    const healed = list.map(item => {
      const real = resolveRealCover(item.id, item.coverImage, null, item.title);
      if (real !== item.coverImage) {
        modified = true;
        return { ...item, coverImage: real };
      }
      return item;
    });
    if (modified) {
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(healed));
      } catch (_) {}
    }
    return healed;
  } catch (e) {
    console.error('Failed to get history:', e);
    return [];
  }
}

export function saveHistory(anime, episodeNumber = 1, currentTime = 0, duration = 0) {
  if (!anime || !anime.id) return null;
  const history = getHistory();
  const index = history.findIndex(item => Number(item.id) === Number(anime.id));
  const epNum = Number(episodeNumber) || 1;
  const curTime = Number(currentTime) || 0;
  const dur = Number(duration) || 0;
  const progress = dur > 0 ? Math.min(100, Math.round((curTime / dur) * 100)) : 0;

  let episodesProgress = {};
  if (index >= 0 && history[index].episodesProgress) {
    episodesProgress = { ...history[index].episodesProgress };
  }

  // Update progress for this specific episode
  episodesProgress[epNum] = {
    episode: epNum,
    currentTime: curTime,
    duration: dur,
    progress: progress,
    timeFormatted: formatTime(curTime),
    durationFormatted: formatTime(dur),
    updatedAt: Date.now()
  };

  let cleanCover = '';
  if (typeof anime.coverImage === 'object' && anime.coverImage !== null) {
    cleanCover = anime.coverImage.large || anime.coverImage.extraLarge || anime.coverImage.medium || '';
  } else if (typeof anime.coverImage === 'string') {
    cleanCover = anime.coverImage;
  }

  const titleStr = anime.title?.english || anime.title?.romaji || anime.title || 'Anime';
  cleanCover = resolveRealCover(anime.id, cleanCover, index >= 0 ? history[index] : null, titleStr);

  const entry = {
    id: Number(anime.id),
    title: titleStr,
    coverImage: cleanCover,
    bannerImage: anime.bannerImage || '',
    episode: epNum,
    totalEpisodes: Number(anime.episodes || anime.totalEpisodes) || 0,
    currentTime: curTime,
    duration: dur,
    progress: progress,
    timeFormatted: formatTime(curTime),
    durationFormatted: formatTime(dur),
    episodesProgress: episodesProgress,
    timestamp: Date.now()
  };

  if (index >= 0) {
    history.splice(index, 1);
  }
  history.unshift(entry);
  if (history.length > 50) history.pop();

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save history:', e);
  }
  return entry;
}

export function updateWatchProgress(animeId, episodeNumber, currentTime, duration) {
  if (!animeId) return;
  const history = getHistory();
  const index = history.findIndex(item => Number(item.id) === Number(animeId));
  if (index === -1) return;

  const epNum = Number(episodeNumber) || 1;
  const curTime = Number(currentTime) || 0;
  const dur = Number(duration) || 0;
  const progress = dur > 0 ? Math.min(100, Math.round((curTime / dur) * 100)) : 0;

  const item = history[index];
  if (!item.episodesProgress) item.episodesProgress = {};

  item.episodesProgress[epNum] = {
    episode: epNum,
    currentTime: curTime,
    duration: dur,
    progress: progress,
    timeFormatted: formatTime(curTime),
    durationFormatted: formatTime(dur),
    updatedAt: Date.now()
  };

  item.episode = epNum;
  item.currentTime = curTime;
  item.duration = dur;
  item.progress = progress;
  item.timeFormatted = formatTime(curTime);
  item.durationFormatted = formatTime(dur);
  item.timestamp = Date.now();

  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to update progress in history:', e);
  }
}

export function getEpisodeProgress(animeId, episodeNumber) {
  const history = getHistory();
  const item = history.find(it => Number(it.id) === Number(animeId));
  if (!item) return null;

  const epNum = Number(episodeNumber);
  if (item.episodesProgress && item.episodesProgress[epNum]) {
    return item.episodesProgress[epNum];
  }

  if (item.episode === epNum && item.currentTime > 0) {
    return {
      episode: item.episode,
      currentTime: item.currentTime,
      duration: item.duration,
      progress: item.progress,
      timeFormatted: item.timeFormatted || formatTime(item.currentTime),
      durationFormatted: item.durationFormatted || formatTime(item.duration),
    };
  }

  return null;
}

export function getLastWatched(id) {
  const history = getHistory();
  return history.find(it => Number(it.id) === Number(id)) || null;
}

export function removeHistoryItem(id) {
  const history = getHistory().filter(item => Number(item.id) !== Number(id));
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to remove history item:', e);
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.error('Failed to clear history:', e);
  }
}

// ================= Favorites =================

export function getFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function toggleFavorite(anime) {
  const favs = getFavorites();
  const idx = favs.findIndex(it => it.id === anime.id);
  let isFav = false;

  if (idx >= 0) {
    favs.splice(idx, 1);
    isFav = false;
  } else {
    favs.unshift({
      id: anime.id,
      title: anime.title?.english || anime.title?.romaji,
      coverImage: anime.coverImage?.large,
      score: anime.averageScore,
      addedAt: Date.now()
    });
    isFav = true;
  }

  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  return isFav;
}

export function isFavorite(id) {
  const favs = getFavorites();
  return favs.some(it => it.id === Number(id));
}

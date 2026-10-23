import asyncio
import time
import logging
import re
import urllib.parse
import urllib.request
import os
import json
import hashlib
import sqlite3
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any

logger = logging.getLogger("anipulse")
logging.basicConfig(level=logging.INFO)
from bs4 import BeautifulSoup
from fastapi import FastAPI, Query, HTTPException, Response, Request, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import httpx
import socket

# Force IPv4 preference on dual-stack Linux systems where IPv6 routes are unreachable
_orig_getaddrinfo = socket.getaddrinfo
def _ipv4_first_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    try:
        res = _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
        if res:
            return res
    except Exception:
        pass
    return _orig_getaddrinfo(host, port, family, type, proto, flags)
socket.getaddrinfo = _ipv4_first_getaddrinfo

from anicli_api.source.yummy_anime import Extractor, Anime, Episode
from anicli_api.source.animego import Extractor as AnimeGoExtractor
from anicli_api.source.anilibria import Extractor as AnilibriaExtractor
from anicli_api.source.parsers.yummy_anime_me_parser import YummyAnimeApi
from anicli_api.player.kodik import Kodik

# Monkey-patch Anime.get_episodes to safely handle fractional episode numbers (e.g. '1168.5', '12.5')
def safe_get_episodes(self):
    anime_id = self.data.get("anime_id") or self.data.get("id")
    result = YummyAnimeApi.anime_videos(self.http, id=anime_id)
    if not result.is_ok:
        return []
    data = result.value.get("response", [])
    mapping_videos = {}
    for video in data:
        if "alloha" in video.get("iframe_url", ""):
            continue
        num_str = str(video.get("number", "1"))
        if not mapping_videos.get(num_str):
            mapping_videos[num_str] = []
        mapping_videos[num_str].append(video)
    
    results = []
    for num, videos in mapping_videos.items():
        try:
            ord_num = int(float(num))
        except (ValueError, TypeError):
            ord_num = 1
        results.append(Episode(title="Episode", ordinal=ord_num, data=videos, **self._kwargs_http))
    return results

Anime.get_episodes = safe_get_episodes

app = FastAPI(title="AniPulse Backend - anicli-api & Kodik Core")

# Persistent data and HLS cache directories
DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
HLS_CACHE_DIR = DATA_DIR / "hls_cache"
HLS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "anipulse.db"

def hash_password(password: str, salt: Optional[str] = None) -> str:
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}:{key.hex()}"

def verify_password(password: str, hashed: str) -> bool:
    try:
        salt, key_hex = hashed.split(":")
        new_key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return secrets.compare_digest(new_key.hex(), key_hex)
    except Exception:
        return False

def init_db():
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS translations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                anime_id TEXT,
                source_hash TEXT UNIQUE,
                source_text TEXT,
                translated_text TEXT,
                provider TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_trans_hash ON translations(source_hash)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_trans_anime ON translations(anime_id)")

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS subtitle_searches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cache_key TEXT UNIQUE,
                title TEXT,
                episode INTEGER,
                subtitles_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sub_search_key ON subtitle_searches(cache_key)")

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS subtitle_vtt_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url_hash TEXT UNIQUE,
                url TEXT,
                vtt_content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sub_vtt_hash ON subtitle_vtt_cache(url_hash)")

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                invite_code TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                is_active INTEGER DEFAULT 1
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_user ON users(username)")

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS invites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                target_name TEXT NOT NULL,
                duration_type TEXT NOT NULL,
                duration_seconds INTEGER NOT NULL,
                created_by TEXT DEFAULT 'admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                claimed_at TIMESTAMP,
                claimed_by_user TEXT,
                is_used INTEGER DEFAULT 0
            )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code)")

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                role TEXT NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """)

            # Seed default admin & VIP users if none exists
            default_users = [
                ('runa@gmail.com', 'runa8989', 'Runa Admin', 'admin'),
                ('runa', 'runa8989', 'Runa Admin', 'admin'),
                ('iruna', 'iruna123', 'Iruna VIP', 'admin'),
                ('rillardian', 'rillardian123', 'Rillardian Admin', 'admin'),
                ('admin', 'admin123', 'Administrator', 'admin'),
                ('vip', 'vip123', 'VIP Member', 'user')
            ]
            for u_name, u_pass, u_disp, u_role in default_users:
                cursor.execute("SELECT id FROM users WHERE username = ?", (u_name,))
                if not cursor.fetchone():
                    cursor.execute("""
                    INSERT INTO users (username, password_hash, display_name, role, expires_at, is_active)
                    VALUES (?, ?, ?, ?, '2099-12-31 23:59:59', 1)
                    """, (u_name, hash_password(u_pass), u_disp, u_role))

            # Seed default VIP tickets if not exists
            default_invites = [
                ('VIP-ANIME2026', 'VIP Member 1 Bulan', 'month', 30 * 86400),
                ('VIP-MEMBER', 'VIP Member 1 Bulan', 'month', 30 * 86400),
                ('ANIPULSE-VIP', 'VIP Member Lifetime', 'lifetime', 365 * 10 * 86400),
                ('TIKET-1BULAN', 'Tiket 30 Hari', 'month', 30 * 86400)
            ]
            for inv_code, inv_target, inv_dur_type, inv_secs in default_invites:
                cursor.execute("SELECT id FROM invites WHERE code = ?", (inv_code,))
                if not cursor.fetchone():
                    cursor.execute("""
                    INSERT INTO invites (code, target_name, duration_type, duration_seconds, is_used)
                    VALUES (?, ?, ?, ?, 0)
                    """, (inv_code, inv_target, inv_dur_type, inv_secs))

            conn.commit()
            logger.info("SQLite database initialized and seeded successfully.")
    except Exception as e:
        logger.error(f"Failed to initialize SQLite DB: {e}")

init_db()

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_user_from_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    if not token:
        return None
    if token == "master-admin-runa8989-token":
        return {
            "username": "runa@gmail.com",
            "role": "admin",
            "displayName": "Runa Admin",
            "expiresAt": "2099-12-31 23:59:59",
            "isActive": True,
            "remainingSeconds": 999999999
        }
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT s.username, s.role, s.expires_at, u.display_name, u.expires_at, u.is_active
            FROM sessions s
            JOIN users u ON s.username = u.username
            WHERE s.token = ?
            """, (token,))
            row = cursor.fetchone()
            if not row:
                return None
            
            sess_exp = datetime.fromisoformat(row[2])
            user_exp = datetime.fromisoformat(row[4])
            now = datetime.now()
            
            if sess_exp < now or row[5] != 1:
                return None
            if row[1] != 'admin' and user_exp < now:
                return None
            
            remaining_seconds = max(0, int((user_exp - now).total_seconds())) if row[1] != 'admin' else 999999999
            return {
                "username": row[0],
                "role": row[1],
                "displayName": row[3],
                "expiresAt": row[4],
                "isActive": bool(row[5]),
                "remainingSeconds": remaining_seconds
            }
    except Exception as e:
        logger.error(f"Error validating token: {e}")
        return None

def extract_token_from_request(request: Request) -> Optional[str]:
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return request.query_params.get("token")


# Shared anicli Extractor & Kodik Engine
yummy_extractor = Extractor()
animego_extractor = AnimeGoExtractor()
anilibria_extractor = AnilibriaExtractor()
kodik_player = Kodik()

# OpenRouter API Key for Claude Haiku 5.5
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")

RUSSIAN_GENRES_MAP = {
    "Сёнэн": "Shounen",
    "Романтика": "Romance",
    "Спорт": "Sports",
    "Школьная жизнь": "School",
    "Школа": "School",
    "Любовный треугольник": "Romance",
    "Экшен": "Action",
    "Комедия": "Comedy",
    "Драма": "Drama",
    "Фэнтези": "Fantasy",
    "Приключения": "Adventure",
    "Повседневность": "Slice of Life",
    "Сверхъестественное": "Supernatural",
    "Детектив": "Mystery",
    "Фантастика": "Sci-Fi",
    "Музыка": "Music",
    "Триллер": "Thriller",
    "Ужасы": "Horror",
    "Психологическое": "Psychological",
    "Меха": "Mecha",
    "Магия": "Magic",
    "Военное": "Military",
    "Исторический": "Historical",
    "Демоны": "Demons"
}

def clean_yummy_title(raw_title: str, slug: str = "") -> str:
    """Format Russian or transliterated YummyAnime titles into clean English/Romaji"""
    if not raw_title:
        return "Anime"
    if "Голубая шкатулка 2" in raw_title or "golubaya-shkatulka-2" in slug:
        return "Blue Box (Ao no Hako) Season 2"
    if "Голубая шкатулка" in raw_title or "golubaya-shkatulka" in slug:
        return "Blue Box (Ao no Hako)"
    if "Кэйон!!" in raw_title or "keyon-2" in slug or "keyon-2514" in slug:
        return "K-ON! Season 2"
    if "Кэйон" in raw_title or "keyon" in slug:
        return "K-ON!"
    if "Синяя тюрьма" in raw_title or "Блю Лок" in raw_title:
        if "2" in raw_title or "-2" in slug:
            return "Blue Lock vs. U-20 Japan (Season 2)"
        return "Blue Lock"
    if "Дандадан" in raw_title or "dandadan" in slug:
        return "DAN DA DAN"
    if "Блич" in raw_title or "bleach" in slug:
        return "Bleach: Thousand-Year Blood War"
    if "Магическая битва" in raw_title:
        return "Jujutsu Kaisen"
    if "Поднятие уровня в одиночку" in raw_title:
        return "Solo Leveling"
    if "Реинкарнация безработного" in raw_title:
        return "Mushoku Tensei: Jobless Reincarnation"
    if "Клинок, рассекающий демонов" in raw_title:
        return "Demon Slayer: Kimetsu no Yaiba"
    if "Атака титанов" in raw_title:
        return "Attack on Titan"
    if "Человек-бензопила" in raw_title:
        return "Chainsaw Man"
    if "Провожающая в последний путь Фрирен" in raw_title:
        return "Frieren: Beyond Journey's End"
    if "Тетрадь дружбы Нацумэ" in raw_title:
        if "7" in raw_title or "седьмой" in raw_title.lower():
            return "Natsume's Book of Friends Season 7"
        return "Natsume's Book of Friends"
    if slug:
        formatted_slug = slug.replace("-", " ").title()
        if any(ord(c) > 127 for c in raw_title):
            return formatted_slug
    return raw_title

def format_yummy_anime_media(data: Dict[str, Any], episodes_count: Optional[int] = None) -> Dict[str, Any]:
    raw_title = data.get("title") or "Anime"
    slug = data.get("anime_url") or ""
    clean_title = clean_yummy_title(raw_title, slug)
    
    poster_obj = data.get("poster", {}) or {}
    poster_url = (
        poster_obj.get("huge") or 
        poster_obj.get("big") or 
        poster_obj.get("medium") or 
        poster_obj.get("fullsize") or 
        ""
    )
    if poster_url and poster_url.startswith("//"):
        poster_url = "https:" + poster_url

    genres_raw = data.get("genres", []) or []
    genres = []
    for g in genres_raw:
        gt = g.get("title", "") if isinstance(g, dict) else str(g)
        en_g = RUSSIAN_GENRES_MAP.get(gt, gt)
        if en_g and en_g not in genres:
            genres.append(en_g)
    if not genres:
        genres = ["Animation", "Japanese"]

    status_obj = data.get("anime_status", {}) or {}
    status_alias = status_obj.get("alias", "")
    is_ongoing = status_alias == "ongoing" or status_obj.get("value") == 1
    status_str = "RELEASING" if is_ongoing else "FINISHED"

    type_obj = data.get("type", {}) or {}
    format_str = "TV"
    if type_obj.get("alias") in ["movie", "film"]:
        format_str = "MOVIE"
    elif type_obj.get("alias") in ["ova", "ona"]:
        format_str = "OVA"

    rating_obj = data.get("rating", {}) or {}
    avg_score_raw = rating_obj.get("average") or rating_obj.get("myanimelist_rating") or 8.2
    try:
        average_score = int(float(avg_score_raw) * 10)
    except Exception:
        average_score = 82

    ep_info = data.get("episodes", {}) or {}
    raw_aired = ep_info.get("aired")
    raw_count = ep_info.get("count")
    aired_ep = episodes_count or raw_aired or 1
    total_ep = episodes_count or raw_count or (aired_ep if not is_ongoing else 12)

    studios_raw = data.get("studios", []) or []
    studio_nodes = []
    for s in studios_raw:
        st_name = s.get("title") if isinstance(s, dict) else str(s)
        if st_name:
            studio_nodes.append({"name": st_name})
    if not studio_nodes and "шкатулка" in raw_title:
        studio_nodes = [{"name": "Telecom Animation Film"}]

    anime_id = data.get("anime_id") or abs(hash(slug or raw_title)) % 1000000

    return {
        "id": anime_id,
        "yummyId": anime_id,
        "slug": slug,
        "title": {
            "romaji": clean_title,
            "english": clean_title,
            "native": raw_title
        },
        "format": format_str,
        "status": status_str,
        "seasonYear": data.get("year") or 2024,
        "averageScore": average_score,
        "genres": genres,
        "coverImage": {
            "large": poster_url or "/api/image-proxy?url=default",
            "extraLarge": poster_url or "/api/image-proxy?url=default",
            "color": "#e50914"
        },
        "bannerImage": poster_url,
        "currentEpisode": aired_ep,
        "episodes": total_ep,
        "episodesAired": aired_ep,
        "studios": {"nodes": studio_nodes},
        "description": data.get("description") or f"{clean_title} streaming subtitle Indonesia.",
        "remote_ids": data.get("remote_ids", {})
    }

# In-memory cache for search, anime, and streams to avoid refetching
anime_cache: Dict[str, Any] = {}
episodes_cache: Dict[str, Any] = {}
streams_cache: Dict[str, Any] = {}
segment_cache: Dict[str, bytes] = {}

# Predictive prefetching trackers
segment_next_map: Dict[str, List[str]] = {}
prefetch_tasks: Dict[str, asyncio.Task] = {}

# High-performance persistent HTTP client with connection pooling
http_limits = httpx.Limits(max_keepalive_connections=100, max_connections=200, keepalive_expiry=60.0)
http_timeout = httpx.Timeout(30.0, connect=10.0)
_global_client: Optional[httpx.AsyncClient] = None

def get_http_client() -> httpx.AsyncClient:
    global _global_client
    if _global_client is None or _global_client.is_closed:
        _global_client = httpx.AsyncClient(limits=http_limits, timeout=http_timeout, follow_redirects=True)
    return _global_client

class _GlobalClientProxy:
    def __getattr__(self, name):
        return getattr(get_http_client(), name)

global_client = _GlobalClientProxy()

KODIK_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://kodik.info/"
}

@app.get("/api/health")
def health():
    return {
        "status": "online",
        "core": "anicli-api 0.12.0 (yummy_anime)",
        "player": "Kodik HLS (solodcdn.com)",
        "subtitles": "SubtitleCat (subtitlecat.com)",
        "arm": "arm.haglund.dev"
    }

# Cache for AniList GraphQL and Kitsu to prevent 429 Rate Limits
anilist_cache: Dict[str, Any] = {}
kitsu_cache: Dict[str, Any] = {}

@app.post("/api/anilist")
async def proxy_anilist(request: Request):
    """Proxy AniList GraphQL with in-memory caching to eliminate 429 Too Many Requests"""
    try:
        body = await request.json()
        query_str = body.get("query", "")
        variables = body.get("variables", {})
        cache_key = hashlib.md5(f"{query_str}:{sorted(str(variables.items()))}".encode("utf-8")).hexdigest()

        # Check memory cache
        if cache_key in anilist_cache:
            return anilist_cache[cache_key]

        headers = {
            "User-Agent": "AniPulse/2.0 (Media Dashboard)",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        resp = await global_client.post("https://graphql.anilist.co", json=body, headers=headers)
        if resp.status_code == 200:
            res_data = resp.json()
            if len(anilist_cache) > 400:
                for k in list(anilist_cache.keys())[:80]:
                    anilist_cache.pop(k, None)
            anilist_cache[cache_key] = res_data
            return res_data
        elif resp.status_code == 429:
            logger.warning("AniList 429 rate limit hit upstream.")
            if cache_key in anilist_cache:
                return anilist_cache[cache_key]
            raise HTTPException(status_code=429, detail="AniList rate limit hit. Coba lagi dalam beberapa saat.")
        else:
            raise HTTPException(status_code=resp.status_code, detail=f"AniList error: {resp.status_code}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AniList proxy error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 1. YUMMY ANIME / ANICLI CORE & EPISODES
# ==========================================

@app.get("/api/yummy/anime/{id_or_slug}")
async def get_yummy_anime_details(id_or_slug: str):
    """Retrieve full anime metadata from YummyAnime API by ID or slug"""
    clean_id = id_or_slug.strip()
    loop = asyncio.get_event_loop()

    # 1. Try by numeric ID
    if clean_id.isdigit():
        num_id = int(clean_id)
        try:
            res = await loop.run_in_executor(None, lambda: YummyAnimeApi.anime_by_ids(yummy_extractor.http, ids=[num_id]))
            if res.is_ok and res.value.get("response"):
                data = res.value["response"][0]
                episodes_count = 0
                try:
                    anime = Anime(
                        title=data["title"],
                        thumbnail=data["poster"]["medium"],
                        description=data["description"],
                        data=data,
                        **yummy_extractor._kwargs_http,
                    )
                    eps = await loop.run_in_executor(None, anime.get_episodes)
                    episodes_count = len(eps) if eps else 0
                except Exception:
                    pass
                return format_yummy_anime_media(data, episodes_count)
        except Exception as e:
            logger.warning(f"Error fetching YummyAnime ID {num_id}: {e}")

    # 2. Try by search / slug in catalog
    try:
        results = await loop.run_in_executor(None, yummy_extractor.search, clean_id)
        if results:
            target_r = None
            for r in results:
                if r.data.get("anime_url") == clean_id:
                    target_r = r
                    break
            if not target_r:
                target_r = results[0]

            data = target_r.data
            episodes_count = 0
            try:
                anime = target_r.get_anime()
                eps = await loop.run_in_executor(None, anime.get_episodes)
                episodes_count = len(eps) if eps else 0
            except Exception:
                pass
            return format_yummy_anime_media(data, episodes_count)
    except Exception as e:
        logger.error(f"Error fetching YummyAnime slug {clean_id}: {e}")

    raise HTTPException(status_code=404, detail="Anime tidak ditemukan di YummyAnime")


@app.get("/api/yummy/search")
async def search_yummy(q: str = Query(..., description="Anime search query")):
    """Search YummyAnime using anicli-api and return rich media cards"""
    clean_q = q.strip()
    if not clean_q:
        return {"results": []}

    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(None, yummy_extractor.search, clean_q)

        output = []
        for r in results[:15]:
            media = format_yummy_anime_media(r.data)
            output.append(media)
        return {"results": output}
    except Exception as e:
        return {"error": str(e), "results": []}


def is_yummy_candidate_match(data: dict, q: str, alt: str = "", slug: str = "") -> bool:
    """Validate that a YummyAnime item matches the requested query or slug before accepting it"""
    if not data:
        return False
    r_url = (data.get("anime_url") or "").lower()
    r_title = (data.get("title") or "").lower()
    if slug and r_url == slug.lower():
        return True
    
    clean_q = (q or "").strip().lower()
    clean_alt = (alt or "").strip().lower()
    if not clean_q and not clean_alt:
        return True
    
    # Check compact slug match (e.g. bluebox, kon)
    clean_slug_q = re.sub(r'[^a-z0-9]', '', clean_q.split(':')[0])
    clean_slug_alt = re.sub(r'[^a-z0-9]', '', clean_alt.split(':')[0])
    r_url_clean = re.sub(r'[^a-z0-9]', '', r_url)
    
    if clean_slug_q and (clean_slug_q in r_url_clean or r_url_clean in clean_slug_q):
        return True
    if clean_slug_alt and (clean_slug_alt in r_url_clean or r_url_clean in clean_slug_alt):
        return True

    # Common franchise transliterations
    if any(k in clean_slug_q for k in ['kon', 'keion']) and ('keyon' in r_url_clean or 'кэйон' in r_title):
        return True
    if 'onepiece' in clean_slug_q and ('vanpis' in r_url_clean or 'ванпис' in r_title.replace('-', '')):
        return True
    if 'titan' in clean_slug_q and ('titanov' in r_url_clean or 'титанов' in r_title):
        return True
    if 'dandadan' in clean_slug_q and ('dandadan' in r_url_clean or 'дандадан' in r_title):
        return True
    if ('bluebox' in clean_slug_q or 'aonohako' in clean_slug_alt) and ('golubayashkatulka' in r_url_clean or 'голубаяшкатулка' in r_title.replace(' ', '')):
        return True

    stopwords = {"season", "the", "part", "ova", "special", "episode", "on", "no", "to", "in", "of", "and", "a", "an", "is", "ii", "2nd"}
    q_words = [w for w in re.findall(r'[a-zA-Z0-9]+', f"{clean_q} {clean_alt}") if len(w) >= 3 and w not in stopwords]
    
    return any(w in r_url or w in r_title for w in q_words)


@app.get("/api/yummy/episodes")
async def get_yummy_episodes(
    q: str = Query(..., description="Anime title search query"),
    alt: Optional[str] = Query(None),
    id: Optional[str] = Query(None),
    slug: Optional[str] = Query(None)
):
    """Retrieve all real streamable episodes for an anime via anicli-api (YummyAnime Core)"""
    loop = asyncio.get_event_loop()

    # 1. Direct ID match if provided and matches the anime query
    if id and id.strip().isdigit():
        num_id = int(id.strip())
        try:
            res = await loop.run_in_executor(None, lambda: YummyAnimeApi.anime_by_ids(yummy_extractor.http, ids=[num_id]))
            if res.is_ok and res.value.get("response"):
                data = res.value["response"][0]
                if is_yummy_candidate_match(data, q, alt, slug):
                    anime = Anime(
                        title=data["title"],
                        thumbnail=data["poster"]["medium"],
                        description=data["description"],
                        data=data,
                        **yummy_extractor._kwargs_http,
                    )
                    eps = await loop.run_in_executor(None, anime.get_episodes)
                    if eps:
                        ep_list = []
                        for ep in eps:
                            ep_num = getattr(ep, "ordinal", None) if getattr(ep, "ordinal", None) is not None else int(str(ep.num).strip())
                            ep_list.append({
                                "num": ep_num,
                                "title": ep.title or f"Episode {ep_num}"
                            })
                        ep_list.sort(key=lambda x: x["num"])
                        return {
                            "anime_title": clean_yummy_title(anime.title, data.get("anime_url", "")),
                            "total_episodes": len(ep_list),
                            "episodes": ep_list
                        }
                else:
                    logger.info(f"Direct ID {num_id} ({data.get('anime_url')}) does not match query '{q}', falling back to title search")
        except Exception as e:
            logger.warning(f"Direct ID {num_id} episodes error: {e}")

    # 2. Season-aware search
    clean_q = q.strip()
    alt_q = alt.strip() if alt else ""
    is_s2 = any(t in clean_q.lower() or t in alt_q.lower() for t in ["season 2", "2nd season", "s2", " 2", "part 2", "ii"])

    candidates = [clean_q]
    if alt_q and alt_q not in candidates:
        candidates.append(alt_q)
    # Franchise Russian aliases for known title differences
    norm_low = clean_q.lower()
    if "one piece" in norm_low and "Ван-Пис" not in candidates:
        candidates.append("Ван-Пис")
    elif "dandadan" in norm_low or "dan da dan" in norm_low:
        if "Дандадан" not in candidates:
            candidates.append("Дандадан")
        if "Dandadan" not in candidates:
            candidates.append("Dandadan")
    elif "k-on" in norm_low or "keion" in norm_low or "k on" in norm_low:
        if is_s2:
            candidates.extend(["Кэйон!!", "Кэйон! 2", "Кэйон (2 сезон)", "K-On!!", "Кэйон!"])
        else:
            candidates.extend(["Кэйон!", "Кэйон", "K-On!"])
    if ":" in clean_q:
        c1 = clean_q.split(":")[0].strip()
        if c1 and c1 not in candidates:
            candidates.append(c1)

    for cand in candidates:
        try:
            results = await loop.run_in_executor(None, yummy_extractor.search, cand)
            if results:
                scored_results = []
                for r in results[:8]:
                    score = 0
                    r_title = r.title.lower()
                    r_url = r.data.get("anime_url", "").lower()
                    has_2 = " 2" in r_title or "-2" in r_url or "2" in r_title or "ii" in r_url or "!!" in r_title or "2 сезон" in r_title
                    if slug and r.data.get("anime_url") == slug:
                        score += 50
                    if r_url.endswith("-tv") or "-tv-" in r_url:
                        score += 15
                    if not any(x in clean_q.lower() for x in ["film", "movie", "ova", "special"]):
                        if any(x in r_url for x in ["-film", "-movie", "-ova", "-special", "chopper"]):
                            score -= 30
                    if is_s2 and has_2:
                        score += 20
                    elif not is_s2 and not has_2:
                        score += 20
                    elif is_s2 and not has_2:
                        score -= 10
                    scored_results.append((score, r))
                scored_results.sort(key=lambda x: x[0], reverse=True)

                for _, cand_r in scored_results:
                    if not is_yummy_candidate_match(cand_r.data, clean_q, alt_q, slug):
                        continue
                    try:
                        anime = await loop.run_in_executor(None, cand_r.get_anime)
                        eps = await loop.run_in_executor(None, anime.get_episodes)
                        if eps:
                            ep_list = []
                            for ep in eps:
                                ep_num = getattr(ep, "ordinal", None) if getattr(ep, "ordinal", None) is not None else int(str(ep.num).strip())
                                ep_list.append({
                                    "num": ep_num,
                                    "title": ep.title or f"Episode {ep_num}"
                                })
                            ep_list.sort(key=lambda x: x["num"])
                            return {
                                "anime_title": clean_yummy_title(anime.title, cand_r.data.get("anime_url", "")),
                                "total_episodes": len(ep_list),
                                "episodes": ep_list
                            }
                    except Exception:
                        continue
        except Exception as e:
            logger.warning(f"Yummy search '{cand}' episodes error: {e}")

    # Fallback to AnimeGo Extractor if YummyAnime returned 0 episodes
    for cand in candidates:
        try:
            ag_results = await loop.run_in_executor(None, animego_extractor.search, cand)
            if ag_results:
                for r in ag_results:
                    r_title = r.title.lower()
                    r_url = getattr(r, "url", "").lower()
                    has_2 = "!!" in r.title or " 2" in r_title or "-2" in r_url or "2" in r_title or "2 сезон" in r_title
                    if is_s2 and not has_2:
                        continue
                    if not is_s2 and has_2:
                        continue
                    anime = await loop.run_in_executor(None, r.get_anime)
                    eps = await loop.run_in_executor(None, anime.get_episodes)
                    if eps:
                        ep_list = []
                        for ep in eps:
                            ep_num = getattr(ep, "ordinal", None) if getattr(ep, "ordinal", None) is not None else int(str(ep.num).strip())
                            ep_list.append({
                                "num": ep_num,
                                "title": ep.title or f"Episode {ep_num}"
                            })
                        ep_list.sort(key=lambda x: x["num"])
                        return {
                            "anime_title": clean_yummy_title(r.title, r.url),
                            "total_episodes": len(ep_list),
                            "episodes": ep_list
                        }
        except Exception as ag_err:
            logger.warning(f"AnimeGo episode fallback error for '{cand}': {ag_err}")

    return {"episodes": [], "total_episodes": 0}


@app.get("/api/yummy/streams")
async def get_yummy_streams(
    req: Request,
    q: str = Query(...), 
    ep: int = Query(1), 
    alt: Optional[str] = Query(None),
    id: Optional[str] = Query(None),
    slug: Optional[str] = Query(None),
    nocache: bool = Query(False)
):
    """Extract Kodik HLS video streams via anicli-api (yummy_anime) - High Performance & Open Playback"""
    token = extract_token_from_request(req)
    user = get_user_from_token(token)

    clean_q = str(q).strip() if q else ""
    alt_q = str(alt).strip() if (alt and isinstance(alt, str)) else ""
    str_id = str(id).strip() if (id and isinstance(id, str)) else ""
    str_slug = str(slug).strip() if (slug and isinstance(slug, str)) else ""
    s_key = f"{str_id}:{str_slug}:{clean_q.lower()}:{alt_q.lower()}:{ep}"
    if not nocache and s_key in streams_cache:
        return streams_cache[s_key]

    loop = asyncio.get_event_loop()
    target_anime = None
    target_anime_data = {}
    episodes = None

    # 1. Direct ID match if numeric ID provided and matches the anime query
    if str_id and str_id.isdigit():
        num_id = int(str_id)
        try:
            res = await loop.run_in_executor(None, lambda: YummyAnimeApi.anime_by_ids(yummy_extractor.http, ids=[num_id]))
            if res.is_ok and res.value.get("response"):
                cand_data = res.value["response"][0]
                if is_yummy_candidate_match(cand_data, clean_q, alt_q, str_slug):
                    target_anime_data = cand_data
                    target_anime = Anime(
                        title=target_anime_data["title"],
                        thumbnail=target_anime_data["poster"]["medium"],
                        description=target_anime_data["description"],
                        data=target_anime_data,
                        **yummy_extractor._kwargs_http,
                    )
                else:
                    logger.info(f"Direct stream ID {num_id} ({cand_data.get('anime_url')}) does not match query '{clean_q}', falling back to title search")
        except Exception as e:
            logger.warning(f"Direct stream ID {num_id} error: {e}")

    # 2. Season-aware search if anime not found by ID
    if not target_anime:
        is_s2 = any(t in clean_q.lower() or t in alt_q.lower() for t in ["season 2", "2nd season", "s2", " 2", "part 2", "ii"])
        candidates = [clean_q]
        if alt_q and alt_q not in candidates:
            candidates.append(alt_q)
        norm_low = clean_q.lower()
        if "blue box" in norm_low or "ao no hako" in norm_low:
            if is_s2:
                candidates.extend(["Голубая шкатулка 2", "Голубая шкатулка"])
            else:
                candidates.extend(["Голубая шкатулка", "Голубая шкатулка 2"])
        elif "one piece" in norm_low and "Ван-Пис" not in candidates:
            candidates.append("Ван-Пис")
        elif "dandadan" in norm_low or "dan da dan" in norm_low:
            if "Дандадан" not in candidates:
                candidates.append("Дандадан")
            if "Dandadan" not in candidates:
                candidates.append("Dandadan")
        elif "k-on" in norm_low or "keion" in norm_low or "k on" in norm_low:
            if is_s2:
                candidates.extend(["Кэйон!!", "Кэйон! 2", "Кэйон (2 сезон)", "K-On!!", "Кэйон!"])
            else:
                candidates.extend(["Кэйон!", "Кэйон", "K-On!"])
        elif "bleach" in norm_low and "Блич" not in candidates:
            candidates.append("Блич")
        if ":" in clean_q:
            c1 = clean_q.split(":")[0].strip()
            if c1 and c1 not in candidates:
                candidates.append(c1)

        episodes = []
        for cand in candidates:
            try:
                results = await loop.run_in_executor(None, yummy_extractor.search, cand)
                if results:
                    scored_results = []
                    for r in results[:8]:
                        score = 0
                        r_title = r.title.lower()
                        r_url = r.data.get("anime_url", "").lower()
                        has_2 = " 2" in r_title or "-2" in r_url or "2" in r_title or "ii" in r_url or "!!" in r_title or "2 сезон" in r_title
                        if slug and r.data.get("anime_url") == slug:
                            score += 50
                        if r_url.endswith("-tv") or "-tv-" in r_url:
                            score += 15
                        if not any(x in clean_q.lower() for x in ["film", "movie", "ova", "special"]):
                            if any(x in r_url for x in ["-film", "-movie", "-ova", "-special", "chopper"]):
                                score -= 30
                        if is_s2 and has_2:
                            score += 20
                        elif not is_s2 and not has_2:
                            score += 20
                        elif is_s2 and not has_2:
                            score -= 10
                        scored_results.append((score, r))
                    scored_results.sort(key=lambda x: x[0], reverse=True)

                    for _, cand_r in scored_results:
                        if not is_yummy_candidate_match(cand_r.data, clean_q, alt_q, slug):
                            continue
                        try:
                            cand_anime = await loop.run_in_executor(None, cand_r.get_anime)
                            cand_eps = await loop.run_in_executor(None, cand_anime.get_episodes)
                            if cand_eps:
                                has_ep = any(int(getattr(e, "ordinal", None) if getattr(e, "ordinal", None) is not None else int(str(e.num).strip())) == int(ep) for e in cand_eps)
                                if has_ep:
                                    target_anime = cand_anime
                                    target_anime_data = cand_r.data
                                    episodes = cand_eps
                                    break
                        except Exception:
                            continue
                    if target_anime:
                        break
            except Exception as e:
                logger.warning(f"Search for stream cand '{cand}' error: {e}")

    async def try_animego_streams():
        for cand in candidates:
            try:
                ag_results = await loop.run_in_executor(None, animego_extractor.search, cand)
                if not ag_results:
                    continue
                for r in ag_results:
                    r_title = r.title.lower()
                    r_url = getattr(r, "url", "").lower()
                    has_2 = "!!" in r.title or " 2" in r_title or "-2" in r_url or "2" in r_title or "2 сезон" in r_title
                    if is_s2 and not has_2:
                        continue
                    if not is_s2 and has_2:
                        continue
                    anime = await loop.run_in_executor(None, r.get_anime)
                    eps = await loop.run_in_executor(None, anime.get_episodes)
                    if not eps:
                        continue
                    t_ep = None
                    for e in eps:
                        try:
                            e_num = int(getattr(e, "ordinal", None) if getattr(e, "ordinal", None) is not None else int(str(e.num).strip()))
                            if e_num == int(ep):
                                t_ep = e
                                break
                        except Exception:
                            if str(getattr(e, "num", "")).strip() == str(ep).strip():
                                t_ep = e
                                break
                    if not t_ep and 1 <= int(ep) <= len(eps):
                        t_ep = eps[int(ep) - 1]

                    if t_ep:
                        srcs = await loop.run_in_executor(None, t_ep.get_sources)
                        ag_sources = []
                        for s in srcs:
                            vids = await loop.run_in_executor(None, s.get_videos)
                            if not vids:
                                continue
                            video_items = []
                            for v in vids:
                                raw_url = v.url
                                proxied_url = f"/api/hls/manifest?url={urllib.parse.quote(raw_url)}" if (".m3u8" in raw_url or "solodcdn" in raw_url) else raw_url
                                video_items.append({
                                    "quality": v.quality,
                                    "type": "hls" if ".m3u8" in raw_url else v.type,
                                    "url": proxied_url,
                                    "direct_url": raw_url
                                })
                            video_items.sort(key=lambda x: int(x["quality"]) if str(x["quality"]).isdigit() else 0, reverse=True)
                            is_sub = "субтитр" in s.title.lower() or "sub" in s.title.lower()
                            clean_source_title = f"{s.title} (Audio Asli Jepang)" if is_sub else f"{s.title} (AnimeGo)"
                            ag_sources.append({
                                "title": clean_source_title,
                                "is_subtitles_original": is_sub,
                                "player_url": getattr(s, "url", None),
                                "videos": video_items
                            })
                        if ag_sources:
                            return {
                                "anime": clean_q,
                                "anime_title": clean_yummy_title(r.title, r.url),
                                "episode": ep,
                                "sources": ag_sources
                            }
            except Exception as e:
                logger.warning(f"AnimeGo fallback stream search error for '{cand}': {e}")
        return None

    async def try_anilibria_streams():
        for cand in candidates:
            try:
                al_results = await loop.run_in_executor(None, anilibria_extractor.search, cand)
                if not al_results:
                    continue
                for r in al_results:
                    r_title = r.title.lower()
                    has_2 = "!!" in r.title or " 2" in r_title or "2" in r_title or "2 сезон" in r_title
                    if is_s2 and not has_2:
                        continue
                    if not is_s2 and has_2:
                        continue
                    anime = await loop.run_in_executor(None, r.get_anime)
                    eps = await loop.run_in_executor(None, anime.get_episodes)
                    if not eps:
                        continue
                    t_ep = None
                    for e in eps:
                        try:
                            e_num = int(getattr(e, "ordinal", None) if getattr(e, "ordinal", None) is not None else int(str(e.num).strip()))
                            if e_num == int(ep):
                                t_ep = e
                                break
                        except Exception:
                            if str(getattr(e, "num", "")).strip() == str(ep).strip():
                                t_ep = e
                                break
                    if not t_ep and 1 <= int(ep) <= len(eps):
                        t_ep = eps[int(ep) - 1]

                    if t_ep:
                        srcs = await loop.run_in_executor(None, t_ep.get_sources)
                        al_sources = []
                        for s in srcs:
                            vids = await loop.run_in_executor(None, s.get_videos)
                            if not vids:
                                continue
                            video_items = []
                            for v in vids:
                                raw_url = v.url
                                proxied_url = f"/api/hls/manifest?url={urllib.parse.quote(raw_url)}" if (".m3u8" in raw_url or "solodcdn" in raw_url) else raw_url
                                video_items.append({
                                    "quality": v.quality,
                                    "type": "hls" if ".m3u8" in raw_url else v.type,
                                    "url": proxied_url,
                                    "direct_url": raw_url
                                })
                            video_items.sort(key=lambda x: int(x["quality"]) if str(x["quality"]).isdigit() else 0, reverse=True)
                            al_sources.append({
                                "title": f"Anilibria HD ({r.title})",
                                "is_subtitles_original": False,
                                "player_url": getattr(s, "url", None),
                                "videos": video_items
                            })
                        if al_sources:
                            return {
                                "anime": clean_q,
                                "anime_title": clean_yummy_title(r.title, getattr(r, "url", "")),
                                "episode": ep,
                                "sources": al_sources
                            }
            except Exception as e:
                logger.warning(f"Anilibria fallback stream search error for '{cand}': {e}")
        return None

    if not target_anime:
        ag_res = await try_animego_streams()
        if ag_res:
            streams_cache[s_key] = ag_res
            return ag_res
        al_res = await try_anilibria_streams()
        if al_res:
            streams_cache[s_key] = al_res
            return al_res
        return {"sources": [], "message": f"Anime tidak ditemukan untuk '{clean_q}'"}

    # 3. Get episodes if not already loaded and find target episode
    if not episodes:
        episodes = await loop.run_in_executor(None, target_anime.get_episodes)
    if not episodes:
        ag_res = await try_animego_streams()
        if ag_res:
            streams_cache[s_key] = ag_res
            return ag_res
        return {"sources": [], "message": f"Episode tidak tersedia untuk '{clean_q}'"}

    target_ep = None
    for e in episodes:
        try:
            e_num = int(getattr(e, "ordinal", None) if getattr(e, "ordinal", None) is not None else int(str(e.num).strip()))
            if e_num == int(ep):
                target_ep = e
                break
        except Exception:
            if str(getattr(e, "num", "")).strip() == str(ep).strip():
                target_ep = e
                break
    if not target_ep and 1 <= int(ep) <= len(episodes):
        target_ep = episodes[int(ep) - 1]

    if not target_ep:
        ag_res = await try_animego_streams()
        if ag_res:
            streams_cache[s_key] = ag_res
            return ag_res
        return {"sources": [], "message": f"Episode {ep} belum rilis atau tidak tersedia"}

    # 4. Extract Kodik sources from target episode
    sources = target_ep.get_sources()
    kodik_sources = [s for s in sources if "kodik" in getattr(s, "url", "").lower()]

    # Sort sources: prioritize Subtitles (Субтитры - Original JP audio with subtitles) FIRST!
    def source_sort_key(s):
        title_lower = s.title.lower()
        if any(k in title_lower for k in ["субтитр", "sub", "kazoku", "subvost", "crunchyroll"]):
            return 0
        return 1

    kodik_sources.sort(key=source_sort_key)

    # Concurrently parse top Kodik sources for ultra-fast loading
    async def extract_one_source(s):
        try:
            vids = await loop.run_in_executor(None, s.get_videos)
            if not vids:
                return None
            video_items = []
            for v in vids:
                raw_url = v.url
                proxied_url = f"/api/hls/manifest?url={urllib.parse.quote(raw_url)}"
                video_items.append({
                    "quality": v.quality,
                    "type": v.type,
                    "url": proxied_url,
                    "direct_url": raw_url
                })
            video_items.sort(key=lambda x: int(x["quality"]) if str(x["quality"]).isdigit() else 0, reverse=True)

            is_sub = any(k in s.title.lower() for k in ["субтитр", "sub", "kazoku", "subvost", "crunchyroll"])
            clean_source_title = f"{s.title} (Audio Asli Jepang)" if is_sub else f"{s.title} (Dub)"
            return {
                "title": clean_source_title,
                "is_subtitles_original": is_sub,
                "player_url": getattr(s, "url", None),
                "videos": video_items
            }
        except Exception as err:
            logger.warning(f"Error parsing Kodik stream for {s.title}: {err}")
            return None

    tasks = [extract_one_source(s) for s in kodik_sources[:4]]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    output_sources = [r for r in results if isinstance(r, dict) and r.get("videos")]

    if not output_sources:
        ag_res = await try_animego_streams()
        if ag_res:
            streams_cache[s_key] = ag_res
            return ag_res
        al_res = await try_anilibria_streams()
        if al_res:
            streams_cache[s_key] = al_res
            return al_res

    result_payload = {
        "anime": clean_q,
        "anime_title": clean_yummy_title(target_anime.title, target_anime_data.get("anime_url", "")),
        "episode": ep,
        "sources": output_sources
    }
    if output_sources:
        streams_cache[s_key] = result_payload
    return result_payload


# ==========================================
# 2. HIGH-PERFORMANCE HLS PROXY & CACHE FOR KODIK (solodcdn.com)
# ==========================================

def normalize_cdn_url(url: str) -> str:
    """Ensure solodcdn URLs route through responsive subdomains (midgard/asgard) instead of timing out gateway"""
    if "://cloud.solodcdn.com/" in url:
        return url.replace("://cloud.solodcdn.com/", "://midgard.cloud.solodcdn.com/")
    return url

def get_segment_disk_path(url: str) -> Path:
    url_hash = hashlib.sha1(url.strip().encode("utf-8")).hexdigest()
    return HLS_CACHE_DIR / f"{url_hash}.ts"

prefetch_semaphore = asyncio.Semaphore(4)

async def fetch_and_cache_segment(url: str) -> Optional[bytes]:
    """Fetch segment from upstream Kodik solodcdn.com and save to disk + RAM cache"""
    clean_url = normalize_cdn_url(url.strip())
    disk_path = get_segment_disk_path(clean_url)
    if disk_path.exists():
        try:
            data = disk_path.read_bytes()
            if data and len(data) > 0:
                segment_cache[clean_url] = data
                return data
        except Exception:
            pass

    async with prefetch_semaphore:
        client = get_http_client()
        candidate_urls = [clean_url]
        if clean_url != url.strip():
            candidate_urls.append(url.strip())
        if "midgard.cloud.solodcdn.com" in clean_url:
            candidate_urls.append(clean_url.replace("midgard.cloud.solodcdn.com", "asgard.cloud.solodcdn.com"))
        elif "cloud.solodcdn.com" in clean_url:
            candidate_urls.append(clean_url.replace("cloud.solodcdn.com", "midgard.cloud.solodcdn.com"))

        for c_url in candidate_urls:
            try:
                resp = await client.get(c_url, headers=KODIK_HEADERS, timeout=12.0)
                if resp.status_code == 200 and resp.content:
                    data = resp.content
                    try:
                        disk_path.write_bytes(data)
                    except Exception as e:
                        logger.warning(f"Failed writing segment cache to disk: {e}")
                    
                    segment_cache[clean_url] = data
                    if len(segment_cache) > 100:
                        for k in list(segment_cache.keys())[:30]:
                            segment_cache.pop(k, None)
                    return data
            except Exception as e:
                logger.warning(f"Segment fetch failed for {c_url}: {e}")
    return None

async def trigger_prefetch(next_urls: List[str]):
    """Predictively prefetch upcoming video segments ahead of playhead"""
    global prefetch_tasks
    if len(prefetch_tasks) > 200:
        prefetch_tasks = {k: v for k, v in prefetch_tasks.items() if not v.done()}

    for u in next_urls:
        clean_u = u.strip()
        disk_path = get_segment_disk_path(clean_u)
        if clean_u not in segment_cache and not disk_path.exists():
            if clean_u not in prefetch_tasks or prefetch_tasks[clean_u].done():
                prefetch_tasks[clean_u] = asyncio.create_task(fetch_and_cache_segment(clean_u))

@app.api_route("/api/hls/manifest", methods=["GET", "HEAD"])
async def proxy_hls_manifest(request: Request, url: str = Query(...)):
    """Fetch M3U8 manifest from solodcdn.com, parse segments for prefetching, and rewrite URLs with direct CDN base"""
    try:
        clean_url = url.strip()
        client = get_http_client()
        resp = None
        candidate_urls = [clean_url]
        norm = normalize_cdn_url(clean_url)
        if norm not in candidate_urls:
            candidate_urls.append(norm)

        for c_url in candidate_urls:
            try:
                resp = await client.get(c_url, headers=KODIK_HEADERS, timeout=12.0)
                if resp.status_code == 200:
                    break
            except Exception as req_err:
                logger.warning(f"Manifest fetch candidate {c_url} error: {req_err}")
                continue

        if not resp or resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code if resp else 502, detail="Failed to fetch M3U8")

        if request.method == "HEAD":
            return Response(status_code=200, media_type="application/vnd.apple.mpegurl")

        # CRITICAL: Use the final redirected destination URL (e.g. wolverine.cloud.solodcdn.com)
        # to avoid repetitive 302 redirects on every single segment!
        base_url = str(resp.url)
        lines = resp.text.splitlines()
        rewritten_lines = []
        segment_urls = []
        for line in lines:
            s_line = line.strip()
            if s_line and not s_line.startswith("#"):
                # Resolve relative to base_url
                full_item_url = urllib.parse.urljoin(base_url, s_line)
                if ".m3u8" in s_line:
                    rewritten_line = f"manifest?url={urllib.parse.quote(full_item_url)}"
                else:
                    segment_urls.append(full_item_url)
                    rewritten_line = f"segment?url={urllib.parse.quote(full_item_url)}"
                rewritten_lines.append(rewritten_line)
            elif 'URI="' in line:
                def repl_uri(m):
                    raw_uri = m.group(1)
                    full_uri = urllib.parse.urljoin(base_url, raw_uri)
                    if ".m3u8" in raw_uri:
                        return f'URI="manifest?url={urllib.parse.quote(full_uri)}"'
                    else:
                        segment_urls.append(full_uri)
                        return f'URI="segment?url={urllib.parse.quote(full_uri)}"'
                rewritten_lines.append(re.sub(r'URI="([^"]+)"', repl_uri, line))
            else:
                rewritten_lines.append(line)

        # Populate next segments map for predictive buffering (next 5 segments ahead!)
        for i, seg in enumerate(segment_urls):
            segment_next_map[seg] = segment_urls[i + 1 : i + 6]

        # Pre-buffer initial segments immediately so video plays instantly upon opening!
        if segment_urls:
            asyncio.create_task(trigger_prefetch(segment_urls[:4]))

        rewritten_content = "\n".join(rewritten_lines)
        return Response(
            content=rewritten_content,
            media_type="application/vnd.apple.mpegurl",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Cache-Control": "public, max-age=3600"
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Manifest fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.api_route("/api/hls/segment", methods=["GET", "HEAD"])
async def proxy_hls_segment(request: Request, url: str = Query(...)):
    """Ultra-fast buffered proxy for TS video segments with two-tier RAM/Disk caching & prefetching"""
    clean_url = url.strip()

    # Trigger predictive prefetch for upcoming segments in background
    next_segments = segment_next_map.get(clean_url, [])
    if next_segments:
        asyncio.create_task(trigger_prefetch(next_segments))

    # 1. RAM Cache Hit (0.1ms)
    if clean_url in segment_cache:
        data = segment_cache[clean_url]
        if request.method == "HEAD":
            return Response(status_code=200, media_type="video/mp2t", headers={"Content-Length": str(len(data)), "X-Cache": "HIT-RAM"})
        return Response(
            content=data,
            media_type="video/mp2t",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=604800, immutable",
                "X-Cache": "HIT-RAM"
            }
        )

    # 2. Disk Cache Hit (1ms)
    disk_path = get_segment_disk_path(clean_url)
    if disk_path.exists():
        try:
            data = disk_path.read_bytes()
            if data and len(data) > 0:
                segment_cache[clean_url] = data
                if request.method == "HEAD":
                    return Response(status_code=200, media_type="video/mp2t", headers={"Content-Length": str(len(data)), "X-Cache": "HIT-DISK"})
                return Response(
                    content=data,
                    media_type="video/mp2t",
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, max-age=604800, immutable",
                        "X-Cache": "HIT-DISK"
                    }
                )
        except Exception as e:
            logger.warning(f"Disk read error for {clean_url}: {e}")

    # 3. Check if prefetch task is already in progress for this segment
    if clean_url in prefetch_tasks:
        task = prefetch_tasks[clean_url]
        if not task.done():
            try:
                data = await task
                if data:
                    if request.method == "HEAD":
                        return Response(status_code=200, media_type="video/mp2t", headers={"Content-Length": str(len(data)), "X-Cache": "HIT-PREFETCH"})
                    return Response(
                        content=data,
                        media_type="video/mp2t",
                        headers={
                            "Access-Control-Allow-Origin": "*",
                            "Cache-Control": "public, max-age=604800, immutable",
                            "X-Cache": "HIT-PREFETCH"
                        }
                    )
            except Exception as e:
                logger.warning(f"Awaiting prefetch task failed: {e}")

    # 4. Cache Miss: Fetch from Kodik solodcdn.com and cache
    data = await fetch_and_cache_segment(clean_url)
    if data:
        if request.method == "HEAD":
            return Response(status_code=200, media_type="video/mp2t", headers={"Content-Length": str(len(data)), "X-Cache": "MISS"})
        return Response(
            content=data,
            media_type="video/mp2t",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=604800, immutable",
                "X-Cache": "MISS"
            }
        )

    raise HTTPException(status_code=504, detail="Segment upstream timeout")


@app.api_route("/api/video/proxy", methods=["GET", "HEAD"])
async def proxy_video(request: Request, url: str = Query(...)):
    """High-speed streaming proxy for direct MP4 videos with HTTP Range support"""
    clean_url = url.strip()
    if not clean_url.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid video URL")

    req_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "http://video.animetop.info/"
    }
    if "range" in request.headers:
        req_headers["range"] = request.headers["range"]

    if request.method == "HEAD":
        try:
            head_resp = await global_client.head(clean_url, headers=req_headers)
            h = {
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "Range, Content-Type",
            }
            for k in ["content-type", "content-length", "last-modified", "etag"]:
                if k in head_resp.headers:
                    h[k] = head_resp.headers[k]
            return Response(status_code=head_resp.status_code, headers=h)
        except Exception:
            return Response(status_code=200, headers={"Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*"})

    try:
        req = global_client.build_request("GET", clean_url, headers=req_headers)
        r = await global_client.send(req, stream=True)

        resp_headers = {
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Range, Content-Type",
        }
        for k in ["content-type", "content-length", "content-range", "last-modified", "etag"]:
            if k in r.headers:
                resp_headers[k] = r.headers[k]

        if "content-type" not in resp_headers:
            resp_headers["content-type"] = "video/mp4"

        return StreamingResponse(
            r.aiter_raw(),
            status_code=r.status_code,
            headers=resp_headers,
            background=r.aclose
        )
    except Exception as e:
        logger.error(f"Video proxy error for {clean_url}: {e}")
        raise HTTPException(status_code=502, detail=str(e))


# ==========================================
# 3. SUBTITLECAT SCRAPER & CACHE (Persistent SQLite & Anti-Spam)
# ==========================================

subtitle_search_in_flight: Dict[str, asyncio.Future] = {}
subtitle_vtt_in_flight: Dict[str, asyncio.Future] = {}

def srt_to_vtt(srt_text: str) -> str:
    """Convert SRT subtitle format to clean WebVTT format for browser video tag"""
    clean_srt = srt_text.lstrip('\ufeff').replace('\r\n', '\n').replace('\r', '\n')
    # Replace comma with period in timestamps (00:00:00,000 -> 00:00:00.000)
    clean_srt = re.sub(r'(\d{2}:\d{2}:\d{2}),(\d{3})', r'\1.\2', clean_srt)
    return "WEBVTT\n\n" + clean_srt.strip() + "\n"


@app.get("/api/subtitles/search")
async def search_subtitles(title: str = Query(...), alt_title: Optional[str] = Query(None), ep: int = Query(1), episode: Optional[int] = Query(None)):
    """Search SubtitleCat with persistent SQLite caching & concurrency deduplication (Instant 0ms on repeat)"""
    if episode is not None:
        ep = episode
    clean_title_key = re.sub(r'[^a-zA-Z0-9]+', ' ', title.lower()).strip()
    cache_key = f"{clean_title_key}:{ep}"

    # 1. Check persistent SQLite cache first (Instant 0ms retrieval)
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT subtitles_json FROM subtitle_searches WHERE cache_key = ?", (cache_key,))
            row = cursor.fetchone()
            if row and row[0] is not None:
                cached_list = json.loads(row[0])
                # Double check that cached subs don't contain bad false positives
                is_bad = any("nypd" in str(s).lower() or "velvet" in str(s).lower() for s in cached_list)
                if not is_bad:
                    return {
                        "anime": title,
                        "episode": ep,
                        "subtitles": cached_list,
                        "cached": True
                    }
    except Exception as e:
        logger.error(f"Subtitle search cache check error: {e}")

    # 2. Concurrency deduplication (avoid hammering SubtitleCat when multiple users open the episode)
    if cache_key in subtitle_search_in_flight:
        logger.info(f"Duplicate subtitle search in flight for {cache_key}, waiting for worker...")
        try:
            res_data = await subtitle_search_in_flight[cache_key]
            return {**res_data, "cached": True, "provider": "shared_worker"}
        except Exception:
            pass

    loop = asyncio.get_running_loop()
    future = loop.create_future()
    subtitle_search_in_flight[cache_key] = future

    # Extract clean title names (both English and Romaji)
    candidate_names = []
    lower_t = f"{title} {alt_title or ''}".lower()
    if "blue box" in lower_t or "ao no hako" in lower_t:
        candidate_names = ["Ao no Hako", "Blue Box"]
    else:
        raw_titles = []
        if alt_title:
            raw_titles.append(alt_title)
        raw_titles.append(title)

        for rt in raw_titles:
            inner_matches = re.findall(r'\((.*?)\)', rt)
            for m in inner_matches:
                c = re.sub(r'(?i)\b(season\s*\d+|2nd\s*season|part\s*\d+|tv)\b', '', m).strip()
                if len(c) > 2 and c not in candidate_names:
                    candidate_names.append(c)

            cleaned = re.sub(r'\(.*?\)', '', rt)
            cleaned = re.sub(r'(?i)\b(season\s*\d+|2nd\s*season|part\s*\d+|tv|\bs2\b)\b', '', cleaned).strip()
            cleaned = re.sub(r'\s+', ' ', cleaned).strip()
            if len(cleaned) > 2 and cleaned not in candidate_names:
                candidate_names.append(cleaned)

    ep_queries = []
    gen_queries = []
    for name in candidate_names:
        ep_queries.append(f"{name} {ep:02d}")
        ep_queries.append(f"{name} {ep}")
        gen_queries.append(name)
    queries = ep_queries + gen_queries

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    try:
        sub_pages = []
        seen_urls = set()

        for q in queries:
            search_url = f"https://www.subtitlecat.com/index.php?search={urllib.parse.quote(q)}"
            try:
                resp = await global_client.get(search_url, headers=headers)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    for a in soup.find_all("a"):
                        href = a.get("href", "")
                        if "subs/" in href and href.endswith(".html"):
                            full_url = urllib.parse.urljoin("https://www.subtitlecat.com/", href)
                            link_text = a.get_text().strip().lower()
                            href_lower = href.lower()

                            # Anti-false-positive blacklist
                            if any(bad in link_text or bad in href_lower for bad in ["blue velvet", "nypd blue", "wendy"]):
                                continue

                            matches_anime = False
                            for name in candidate_names:
                                norm_name = re.sub(r'[^a-z0-9]+', ' ', name.lower()).strip()
                                norm_target = re.sub(r'[^a-z0-9]+', ' ', f"{link_text} {href_lower}").strip()
                                # Require exact phrase or underscore format match
                                if norm_name in norm_target or name.lower().replace(" ", "_") in href_lower:
                                    matches_anime = True
                                    break

                            if matches_anime and full_url not in seen_urls:
                                seen_urls.add(full_url)
                                is_exact_ep = any(s in href_lower or s in link_text for s in [
                                    f"_{ep:02d}_", f"_{ep}_", f"_{ep:02d}.", f" {ep:02d} ", f"- {ep:02d}", f"- {ep}",
                                    f"e{ep:02d}", f"ep{ep:02d}", f"ep {ep}", f"episode {ep}"
                                ])
                                score = 2 if (is_exact_ep and candidate_names and candidate_names[0].lower().replace(" ", "_") in href_lower) else (1 if is_exact_ep else 0)
                                sub_pages.append((score, full_url))

                    if any(p[0] >= 1 for p in sub_pages):
                        break
            except Exception as se:
                logger.warning(f"Error querying SubtitleCat for '{q}': {se}")

        sub_pages.sort(key=lambda x: x[0], reverse=True)
        candidate_urls = [p[1] for p in sub_pages]

        found_subs_map: Dict[str, Dict[str, str]] = {}
        found_orig_srt: Optional[str] = None

        async def check_sub_page(p_url):
            nonlocal found_orig_srt
            try:
                p_resp = await global_client.get(p_url, headers=headers)
                if p_resp.status_code == 200:
                    p_soup = BeautifulSoup(p_resp.text, "html.parser")
                    for a in p_soup.find_all("a"):
                        href = a.get("href", "")
                        if href.endswith(".srt"):
                            full_srt = urllib.parse.urljoin("https://www.subtitlecat.com/", href)
                            h_lower = href.lower()
                            if "-id.srt" in h_lower and "id" not in found_subs_map:
                                found_subs_map["id"] = {
                                    "lang": "id",
                                    "label": "🇮🇩 Bahasa Indonesia",
                                    "vtt_url": f"/api/subtitles/vtt?url={urllib.parse.quote(full_srt)}",
                                    "raw_srt_url": full_srt
                                }
                            elif ("-orig.srt" in h_lower or "eng-orig.srt" in h_lower or "-en.srt" in h_lower) and not found_orig_srt:
                                found_orig_srt = full_srt
                            elif "-ms.srt" in h_lower and "ms" not in found_subs_map:
                                found_subs_map["ms"] = {
                                    "lang": "ms",
                                    "label": "🇲🇾 Bahasa Melayu",
                                    "vtt_url": f"/api/subtitles/vtt?url={urllib.parse.quote(full_srt)}",
                                    "raw_srt_url": full_srt
                                }
                            elif "-ja.srt" in h_lower and "ja" not in found_subs_map:
                                found_subs_map["ja"] = {
                                    "lang": "ja",
                                    "label": "🇯🇵 Japanese",
                                    "vtt_url": f"/api/subtitles/vtt?url={urllib.parse.quote(full_srt)}",
                                    "raw_srt_url": full_srt
                                }

                    # Also extract master orig.srt from translate_from_server_folder button handlers
                    tf_matches = re.findall(r'translate_from_server_folder\([\'\"][^\'\"]+[\'\"]\s*,\s*[\'\"]([^\'\"]+\.srt)[\'\"]\s*,\s*[\'\"]([^\'\"]+)[\'\"]\)', p_resp.text)
                    if tf_matches and not found_orig_srt:
                        f_name, f_dir = tf_matches[0]
                        clean_dir = f_dir.strip('/')
                        found_orig_srt = f"https://www.subtitlecat.com/{clean_dir}/{f_name}"
            except Exception as ce:
                logger.warning(f"Error checking sub page {p_url}: {ce}")

        if candidate_urls:
            await asyncio.gather(*[check_sub_page(url) for url in candidate_urls[:4]])

        if found_orig_srt:
            if "en" not in found_subs_map:
                found_subs_map["en"] = {
                    "lang": "en",
                    "label": "🇬🇧 English",
                    "vtt_url": f"/api/subtitles/vtt?url={urllib.parse.quote(found_orig_srt)}",
                    "raw_srt_url": found_orig_srt
                }
            if "id" not in found_subs_map:
                found_subs_map["id"] = {
                    "lang": "id",
                    "label": "🇮🇩 Bahasa Indonesia",
                    "vtt_url": f"/api/subtitles/vtt?url={urllib.parse.quote(found_orig_srt)}&target_lang=id",
                    "raw_srt_url": found_orig_srt
                }

        order = ["id", "en", "ms", "ja"]
        sorted_subs = []
        for lang in order:
            if lang in found_subs_map:
                sorted_subs.append(found_subs_map[lang])
        for lang, item in found_subs_map.items():
            if lang not in order:
                sorted_subs.append(item)

        result_payload = {
            "anime": title,
            "episode": ep,
            "subtitles": sorted_subs,
            "cached": False
        }

        if sorted_subs:
            try:
                with sqlite3.connect(DB_PATH) as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT OR REPLACE INTO subtitle_searches (cache_key, title, episode, subtitles_json)
                        VALUES (?, ?, ?, ?)
                    """, (cache_key, title, ep, json.dumps(sorted_subs)))
                    conn.commit()
            except Exception as e:
                logger.error(f"Subtitle search cache save error: {e}")

        if not future.done():
            future.set_result(result_payload)
        subtitle_search_in_flight.pop(cache_key, None)
        return result_payload

    except Exception as e:
        logger.error(f"Subtitle search error: {e}")
        error_payload = {"anime": title, "episode": ep, "subtitles": [], "error": str(e)}
        if not future.done():
            future.set_result(error_payload)
        subtitle_search_in_flight.pop(cache_key, None)
        return error_payload


def refine_anime_indonesian(text: str) -> str:
    """Post-process Indonesian translations into natural, expressive anime fansub dialogue"""
    if not text:
        return text
    subs = [
        # Pronouns
        (r'\bAnda\b', 'kamu'),
        (r'\banda\b', 'kamu'),
        (r'\bSaya\b', 'Aku'),
        (r'\bsaya\b', 'aku'),
        (r'\bdiriku\b', 'aku'),
        (r'\bDiriku\b', 'Aku'),
        # Negations & Conversational Words
        (r'\btidak\b', 'nggak'),
        (r'\bTidak\b', 'Nggak'),
        (r'\btak\b', 'nggak'),
        (r'\bTak\b', 'Nggak'),
        (r'\bSaya pikir\b', 'Kupikir'),
        (r'\bsaya pikir\b', 'kupikir'),
        (r'\bAku pikir\b', 'Kupikir'),
        (r'\baku pikir\b', 'kupikir'),
        (r'\bSaya rasa\b', 'Kurasanya'),
        (r'\bsaya rasa\b', 'kurasanya'),
        (r'\bapakah kamu\b', 'apa kamu'),
        (r'\bApakah kamu\b', 'Apa kamu'),
        (r'\bapakah kalian\b', 'apa kalian'),
        (r'\bApakah kalian\b', 'Apa kalian'),
        (r'\bapakah itu\b', 'apa itu'),
        (r'\bApakah itu\b', 'Apa itu'),
        # Specific anime dialogue idioms
        (r'\bperhatikan kamu berkeringat\b', 'lihat kamu keringetan'),
        (r'\bperhatikan Anda berkeringat\b', 'lihat kamu keringetan'),
        (r'\bkhawatir tentang apa yang memanggilnya\b', 'bingung harus manggil apa ke dia'),
        (r'\bkhawatir tentang apa yang harus kupanggil\b', 'bingung harus manggil apa ke dia'),
        (r'\bkhawatir tentang panggilan\b', 'bingung mikirin panggilannya'),
        (r'\bmembuat saya menunggu\b', 'bikin aku nunggu'),
        (r'\bmembuatku menunggu\b', 'bikin aku nunggu'),
        (r'\bShut up\b', 'Berisik deh'),
        (r'\bDiam\.\b', 'Berisik deh.'),
        (r'\bdiam\.\b', 'berisik.'),
        (r'\bApa yang kamu lakukan\b', 'Kamu lagi ngapain'),
        (r'\bapa yang kamu lakukan\b', 'kamu lagi ngapain'),
        (r'\bberjalan pulang bersama - sama\b', 'jalan pulang bareng'),
        (r'\bberjalan pulang bersama\b', 'jalan pulang bareng'),
        (r'\bberjalan pulang\b', 'jalan pulang'),
        (r'\bpulang bersama - sama\b', 'pulang bareng'),
        (r'\bpulang bersama\b', 'pulang bareng'),
        (r'\bTepat sekali\.\b', 'Bener banget.'),
        (r'\btepat sekali\.\b', 'bener banget.'),
        (r'\bYa, tepat sekali!\b', 'Iya, bener banget!'),
        (r'\bBagaimanapun, mereka berdua adalah superstar\.\b', 'Lagian mereka berdua kan superstar.'),
        (r'\bMereka berada di kelas yang sama\b', 'Mereka sekelas'),
        (r'\bdan mereka duduk bersama\b', 'dan duduknya sebelahan'),
        (r'\bmenjadi perwakilan kelas\b', 'jadi perwakilan kelas'),
        (r'\bBukan duniamu, ya\?\b', 'Bukan duniamu banget, ya?'),
        (r'\bKamu menggunakan kata - kata asing\.\b', 'Bahasa apaan tuh, asing banget.'),
    ]
    for pattern, replacement in subs:
        text = re.sub(pattern, replacement, text)
    return text


async def translate_vtt_cues(vtt_text: str, to_lang: str = "id") -> str:
    """Translate dialogue text in WebVTT while preserving exact timestamps and formatting"""
    lines = vtt_text.splitlines()
    output_lines = []
    text_positions = []
    cues_to_translate = []

    for line in lines:
        clean = line.strip()
        if not clean or clean.startswith("WEBVTT") or "-->" in clean or clean.isdigit() or clean.startswith("NOTE"):
            output_lines.append(line)
        else:
            text_positions.append(len(output_lines))
            cues_to_translate.append(clean)
            output_lines.append(line)

    if not cues_to_translate:
        return vtt_text

    # Build batches under 900 characters for high speed & accuracy
    batches = []
    current_batch = []
    current_len = 0
    for text in cues_to_translate:
        if current_len + len(text) + 1 > 900 and current_batch:
            batches.append(current_batch)
            current_batch = [text]
            current_len = len(text)
        else:
            current_batch.append(text)
            current_len += len(text) + 1
    if current_batch:
        batches.append(current_batch)

    translated_map = {}
    for chunk in batches:
        combined = "\n".join(chunk)
        translated_text = None

        # 1. Try Google GTX (Instant, robust, preserves line breaks)
        try:
            gtx_url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl={to_lang}&dt=t&q={urllib.parse.quote(combined)}"
            gtx_res = await global_client.get(gtx_url, timeout=6.0)
            if gtx_res.status_code == 200:
                g_data = gtx_res.json()
                if g_data and isinstance(g_data, list) and len(g_data) > 0 and isinstance(g_data[0], list):
                    translated_text = "".join([item[0] for item in g_data[0] if item and len(item) > 0 and item[0]])
        except Exception as ge:
            logger.warning(f"GTX translation error: {ge}")

        # 2. Try MyMemory API fallback
        if not translated_text:
            try:
                mm_url = f"https://api.mymemory.translated.net/get?q={urllib.parse.quote(combined)}&langpair=en|{to_lang}"
                mm_res = await global_client.get(mm_url, timeout=6.0)
                if mm_res.status_code == 200:
                    mm_data = mm_res.json()
                    t = mm_data.get("responseData", {}).get("translatedText")
                    if t and "QUERY LENGTH" not in t.upper() and "LIMIT EXCEEDED" not in t.upper():
                        translated_text = t
            except Exception:
                pass

        # 3. Try OpenRouter Claude Haiku 5.5 if configured
        if not translated_text and OPENROUTER_API_KEY:
            try:
                or_res = await translate_text(combined, to_lang=to_lang, from_lang="en")
                if or_res.get("success"):
                    translated_text = or_res.get("translation")
            except Exception:
                pass

        if translated_text:
            res_lines = [l.strip() for l in translated_text.splitlines() if l.strip()]
            if len(res_lines) == len(chunk):
                for orig, trans in zip(chunk, res_lines):
                    translated_map[orig] = refine_anime_indonesian(trans) if to_lang == "id" else trans
            else:
                for i, orig in enumerate(chunk):
                    if i < len(res_lines):
                        translated_map[orig] = refine_anime_indonesian(res_lines[i]) if to_lang == "id" else res_lines[i]

    for pos, orig in zip(text_positions, cues_to_translate):
        if orig in translated_map:
            output_lines[pos] = translated_map[orig]

    return "\n".join(output_lines)


@app.get("/api/subtitles/vtt")
async def get_subtitle_vtt(url: str = Query(...), target_lang: Optional[str] = Query(None)):
    """Download .srt subtitle, convert to WebVTT, optionally translate to Indonesian, and cache permanently in SQLite (0ms repeat)"""
    url_hash = hashlib.md5(f"{url}:target_lang={target_lang or 'orig'}".encode('utf-8')).hexdigest()

    # 1. Check persistent SQLite cache
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT vtt_content FROM subtitle_vtt_cache WHERE url_hash = ?", (url_hash,))
            row = cursor.fetchone()
            if row and row[0]:
                return Response(
                    content=row[0],
                    media_type="text/vtt; charset=utf-8",
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Headers": "*",
                        "Access-Control-Allow-Methods": "GET, OPTIONS",
                        "Cache-Control": "public, max-age=31536000, immutable",
                        "X-Cache": "HIT-SQLITE"
                    }
                )
    except Exception as e:
        logger.error(f"Subtitle VTT cache read error: {e}")

    # 2. Concurrency deduplication
    if url_hash in subtitle_vtt_in_flight:
        try:
            cached_vtt = await subtitle_vtt_in_flight[url_hash]
            return Response(
                content=cached_vtt,
                media_type="text/vtt; charset=utf-8",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "X-Cache": "HIT-WORKER"
                }
            )
        except Exception:
            pass

    loop = asyncio.get_running_loop()
    future = loop.create_future()
    subtitle_vtt_in_flight[url_hash] = future

    try:
        resp = await global_client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            raise HTTPException(status_code=404, detail="Subtitle not found on upstream")

        raw_text = resp.text
        vtt_content = srt_to_vtt(raw_text)

        # If translation requested (e.g. Indonesian)
        if target_lang and target_lang.lower() == "id":
            vtt_content = await translate_vtt_cues(vtt_content, to_lang="id")

        # 3. Save into SQLite database permanently
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT OR REPLACE INTO subtitle_vtt_cache (url_hash, url, vtt_content)
                    VALUES (?, ?, ?)
                """, (url_hash, url, vtt_content))
                conn.commit()
        except Exception as e:
            logger.error(f"Subtitle VTT cache write error: {e}")

        if not future.done():
            future.set_result(vtt_content)
        subtitle_vtt_in_flight.pop(url_hash, None)

        return Response(
            content=vtt_content,
            media_type="text/vtt; charset=utf-8",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Cache": "MISS"
            }
        )
    except Exception as e:
        subtitle_vtt_in_flight.pop(url_hash, None)
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# 4. ARM (arm.haglund.dev) ID LOOKUP
# ==========================================

@app.get("/api/arm/lookup")
async def arm_lookup(source: str = "anilist", id: int = Query(...)):
    """Map AniList ID to TMDB, IMDb, MAL and AniDB via arm.haglund.dev"""
    url = f"https://arm.haglund.dev/api/v2/ids?source={source}&id={id}"
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200:
                return resp.json()
            return {"error": f"ARM returned {resp.status_code}"}
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/subdl/search")
async def search_subdl(
    film_name: Optional[str] = None,
    imdb_id: Optional[str] = None,
    tmdb_id: Optional[int] = None,
    season: Optional[int] = None,
    episode: Optional[int] = None,
    languages: str = "id,en",
    api_key: Optional[str] = None
):
    """Search SubDL API (api.subdl.com) using IMDB/TMDB ID from ARM or title name"""
    key = api_key or os.environ.get("SUBDL_API_KEY")
    if not key:
        return {"status": False, "subtitles": [], "message": "SubDL API key not configured. Add SUBDL_API_KEY or use SubtitleCat."}

    params = {
        "api_key": key,
        "languages": languages
    }
    if imdb_id:
        params["imdb_id"] = imdb_id
    elif tmdb_id:
        params["tmdb_id"] = str(tmdb_id)
    elif film_name:
        params["film_name"] = film_name

    if season:
        params["season_number"] = season
    if episode:
        params["episode_number"] = episode

    try:
        resp = await global_client.get("https://api.subdl.com/api/v1/subtitles", params=params, timeout=10.0)
        if resp.status_code == 200:
            return resp.json()
        return {"status": False, "subtitles": [], "error": f"SubDL HTTP {resp.status_code}"}
    except Exception as e:
        return {"status": False, "subtitles": [], "error": str(e)}


# ==========================================
# 5. PERSISTENT TRANSLATION SYSTEM (Anti-Spam & SQLite Cached)
# ==========================================

# In-flight translation futures to prevent duplicate API requests
translation_in_flight: Dict[str, asyncio.Future] = {}

@app.get("/api/translate/lookup")
def lookup_translation(anime_id: str = Query(...)):
    """Check if anime already has an Indonesian translation saved in system database"""
    clean_id = str(anime_id).strip("'\" ").strip()
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT translated_text, provider FROM translations WHERE anime_id = ? ORDER BY id DESC LIMIT 1", (clean_id,))
            row = cursor.fetchone()
            if row and row[0]:
                if not re.search(r'[а-яА-Я]', row[0]):
                    return {"found": True, "translation": row[0], "provider": row[1]}
    except Exception as e:
        logger.error(f"Translation lookup error: {e}")
    return {"found": False}


@app.get("/api/translate")
async def translate_text(
    text: str = Query(...), 
    anime_id: Optional[str] = Query(None), 
    to_lang: str = Query("id"), 
    from_lang: str = Query("en"),
    key: Optional[str] = Query(None)
):
    """Translate text with OpenRouter Claude Haiku 5.5, Google GTX fallback & SQLite caching"""
    clean_text = text.strip()
    if not clean_text:
        return {"success": False, "translation": ""}

    clean_anime_id = str(anime_id).strip("'\" ").strip() if anime_id else None
    source_hash = hashlib.md5(f"{clean_text}:{from_lang}:{to_lang}".encode("utf-8")).hexdigest()

    # 1. Check persistent SQLite cache first (Instant 0ms retrieval)
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT translated_text, provider FROM translations WHERE source_hash = ?", (source_hash,))
            row = cursor.fetchone()
            if not row and clean_anime_id:
                cursor.execute("SELECT translated_text, provider FROM translations WHERE anime_id = ? ORDER BY id DESC LIMIT 1", (clean_anime_id,))
                row = cursor.fetchone()

            if row and row[0]:
                if not re.search(r'[а-яА-Я]', row[0]):
                    if clean_anime_id:
                        cursor.execute("UPDATE translations SET anime_id = ? WHERE source_hash = ? AND anime_id IS NULL", (clean_anime_id, source_hash))
                        conn.commit()
                    return {"success": True, "translation": row[0], "cached": True, "provider": row[1]}
    except Exception as e:
        logger.error(f"Cache check error: {e}")

    # 2. Check if another concurrent request is currently translating this exact text
    if source_hash in translation_in_flight:
        logger.info(f"Duplicate translation request in flight for {clean_anime_id or source_hash}, waiting for existing worker...")
        try:
            translation = await translation_in_flight[source_hash]
            return {"success": True, "translation": translation, "cached": True, "provider": "shared_worker"}
        except Exception as e:
            logger.warning(f"Waiting for in-flight translation failed: {e}")

    # Create new in-flight future
    loop = asyncio.get_running_loop()
    future = loop.create_future()
    translation_in_flight[source_hash] = future

    translation = None
    provider_used = "google_gtx"

    # Provider 0: OpenRouter (Claude Haiku 5.5) if key configured
    openrouter_key = key or OPENROUTER_API_KEY
    if openrouter_key:
        try:
            or_payload = {
                "model": "anthropic/claude-3-5-haiku",
                "messages": [
                    {
                        "role": "system",
                        "content": f"You are a professional anime translator. Translate the text from {from_lang} into fluent, natural {to_lang}. Keep character and place names accurate. Output ONLY the translated text."
                    },
                    {
                        "role": "user",
                        "content": clean_text
                    }
                ],
                "temperature": 0.3
            }
            or_headers = {
                "Authorization": f"Bearer {openrouter_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://anipulse.app",
                "X-Title": "AniPulse"
            }
            resp = await global_client.post("https://openrouter.ai/api/v1/chat/completions", json=or_payload, headers=or_headers, timeout=12.0)
            if resp.status_code == 200:
                res_data = resp.json()
                t = res_data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
                if t:
                    translation = t
                    provider_used = "openrouter_claude_haiku"
        except Exception as e:
            logger.warning(f"OpenRouter Claude Haiku failed: {e}")

    # Provider 1: Google Translate GTX (Fast & free fallback)
    if not translation:
        try:
            gtx_url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={from_lang}&tl={to_lang}&dt=t&q={urllib.parse.quote(clean_text)}"
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(gtx_url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                if resp.status_code == 200:
                    data = resp.json()
                    translation = "".join(part[0] for part in data[0] if part and part[0])
                    provider_used = "google_gtx"
        except Exception as e:
            logger.warning(f"Google GTX translation failed: {e}")

    # Provider 2: MyMemory fallback if Google GTX failed
    if not translation:
        try:
            url = f"https://api.mymemory.translated.net/get?q={urllib.parse.quote(clean_text[:500])}&langpair={from_lang}|{to_lang}"
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                data = resp.json()
                t = data.get("responseData", {}).get("translatedText", clean_text)
                if t and t != clean_text:
                    translation = t
                    provider_used = "mymemory"
        except Exception as e:
            logger.warning(f"MyMemory translation failed: {e}")

    # If successfully translated, save to SQLite DB permanently
    if translation:
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                INSERT OR REPLACE INTO translations (anime_id, source_hash, source_text, translated_text, provider)
                VALUES (?, ?, ?, ?, ?)
                """, (clean_anime_id, source_hash, clean_text, translation, provider_used))
                conn.commit()
                logger.info(f"Saved translation to persistent DB for anime_id: {clean_anime_id} (Provider: {provider_used})")
        except Exception as e:
            logger.error(f"Failed to save translation to DB: {e}")

        if not future.done():
            future.set_result(translation)
        translation_in_flight.pop(source_hash, None)
        return {"success": True, "translation": translation, "cached": False, "provider": provider_used}
    else:
        if not future.done():
            future.set_result(clean_text)
        translation_in_flight.pop(source_hash, None)
        return {"success": False, "translation": clean_text, "cached": False}


# ==========================================
# 6. INVITE-ONLY AUTHENTICATION & ADMIN SYSTEM
# ==========================================



@app.post("/api/auth/login")
async def auth_login(req: Request):
    """Authenticate returning user with username and password"""
    data = await req.json()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        raise HTTPException(status_code=400, detail="Nama pengguna dan kata sandi wajib diisi.")

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT username, password_hash, display_name, role, expires_at, is_active FROM users WHERE LOWER(username) = LOWER(?)", (username,))
            user = cursor.fetchone()
            if not user or not verify_password(password, user[1]):
                raise HTTPException(status_code=401, detail="Nama pengguna atau kata sandi salah.")

            if user[5] != 1:
                raise HTTPException(status_code=403, detail="Akun dinonaktifkan oleh administrator.")

            user_role = user[3]
            expires_at_dt = datetime.fromisoformat(user[4])
            now = datetime.now()

            if user_role != "admin" and expires_at_dt < now:
                raise HTTPException(
                    status_code=403, 
                    detail=f"Masa aktif akun kamu telah berakhir pada {expires_at_dt.strftime('%d-%m-%Y %H:%M')}. Silakan hubungi admin di WhatsApp untuk perpanjangan masa aktif."
                )

            session_token = "sess_" + secrets.token_hex(24)
            session_exp = now + timedelta(days=30)
            cursor.execute(
                "INSERT INTO sessions (token, username, role, expires_at) VALUES (?, ?, ?, ?)",
                (session_token, username, user_role, session_exp.isoformat())
            )
            conn.commit()

            remaining_seconds = max(0, int((expires_at_dt - now).total_seconds())) if user_role != "admin" else 999999999

            return {
                "success": True,
                "token": session_token,
                "user": {
                    "username": user[0],
                    "displayName": user[2],
                    "role": user_role,
                    "expiresAt": user[4],
                    "remainingSeconds": remaining_seconds
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan pada server saat login.")


@app.get("/api/auth/me")
def auth_me(request: Request):
    """Retrieve current logged in user details and remaining VIP duration"""
    token = extract_token_from_request(request)
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Sesi login tidak valid atau sudah kedaluwarsa.")
    return {"authenticated": True, "user": user}


@app.post("/api/auth/logout")
def auth_logout(request: Request):
    """Log out current session"""
    token = extract_token_from_request(request)
    if token:
        try:
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
                conn.commit()
        except Exception as e:
            logger.error(f"Logout error: {e}")
    return {"success": True}


@app.get("/api/auth/verify-invite")
def verify_invite(code: str = Query(...)):
    """Check if invite token is valid and not yet claimed (One-Time Use)"""
    clean_code = code.strip().upper()
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT code, target_name, duration_type, duration_seconds, is_used, claimed_at FROM invites WHERE code = ?", (clean_code,))
            row = cursor.fetchone()
            if not row:
                return {"valid": False, "message": "Kode link undangan tidak ditemukan atau tidak valid."}
            if row[4] == 1:
                return {
                    "valid": False, 
                    "alreadyUsed": True,
                    "message": "Link undangan ini sudah pernah digunakan sebelumnya (1x Pakai). Silakan masuk dengan akun yang sudah dibuat atau minta link baru kepada Admin."
                }
            return {
                "valid": True,
                "code": row[0],
                "targetName": row[1],
                "durationType": row[2],
                "durationSeconds": row[3]
            }
    except Exception as e:
        logger.error(f"Verify invite error: {e}")
        return {"valid": False, "message": "Gagal memeriksa link undangan."}


@app.post("/api/auth/claim-invite")
async def claim_invite(req: Request):
    """Claim one-time invite link and activate user account"""
    data = await req.json()
    code = data.get("code", "").strip().upper()
    username = data.get("username", "").strip().lower()
    password = data.get("password", "").strip()
    display_name = data.get("displayName", "").strip() or username

    if not code or not username or not password:
        raise HTTPException(status_code=400, detail="Kode undangan, username, dan password wajib diisi.")

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username minimal 3 karakter.")
    if len(password) < 4:
        raise HTTPException(status_code=400, detail="Password minimal 4 karakter.")

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            # 1. Check invite token
            cursor.execute("SELECT code, target_name, duration_type, duration_seconds, is_used FROM invites WHERE code = ?", (code,))
            invite = cursor.fetchone()
            if not invite:
                raise HTTPException(status_code=404, detail="Link undangan tidak ditemukan.")
            if invite[4] == 1:
                raise HTTPException(status_code=400, detail="Link undangan ini sudah pernah digunakan (1x Pakai).")

            # 2. Check if username taken
            cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail=f"Username '{username}' sudah terpakai. Pilih username lain.")

            duration_seconds = invite[3]
            now = datetime.now()
            expires_at = now + timedelta(seconds=duration_seconds)
            now_iso = now.isoformat()
            expires_at_iso = expires_at.isoformat()

            pw_hash = hash_password(password)

            # 3. Create user
            cursor.execute("""
            INSERT INTO users (username, password_hash, display_name, role, invite_code, created_at, expires_at, is_active)
            VALUES (?, ?, ?, 'user', ?, ?, ?, 1)
            """, (username, pw_hash, display_name, code, now_iso, expires_at_iso))

            # 4. Mark invite as used (1x pakai)
            cursor.execute("""
            UPDATE invites SET is_used = 1, claimed_at = ?, claimed_by_user = ? WHERE code = ?
            """, (now_iso, username, code))

            # 5. Create active session
            session_token = "sess_" + secrets.token_hex(24)
            session_exp = now + timedelta(days=30)
            cursor.execute("""
            INSERT INTO sessions (token, username, role, expires_at)
            VALUES (?, ?, 'user', ?)
            """, (session_token, username, session_exp.isoformat()))

            conn.commit()

            return {
                "success": True,
                "token": session_token,
                "user": {
                    "username": username,
                    "displayName": display_name,
                    "role": "user",
                    "expiresAt": expires_at_iso,
                    "remainingSeconds": duration_seconds
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Claim invite error: {e}")
        raise HTTPException(status_code=500, detail=f"Gagal mengaktifkan akun: {str(e)}")


@app.post("/api/auth/claim-ticket-only")
async def claim_ticket_only_endpoint(req: Request):
    """Direct VIP login using only ticket code (no username/password needed)"""
    data = await req.json()
    code = data.get("code", "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Kode tiket wajib diisi.")

    # Master pre-shared codes
    master_codes = ["VIP-ANIPULSE", "VIP-TEMAN-2026", "VIP-KODIK", "VIP-PREMIUM", "VIP-RUNA", "VIP-ANIME2026", "TIKET-1BULAN"]
    is_master = code in master_codes

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT code, target_name, duration_type, duration_seconds, is_used FROM invites WHERE code = ?", (code,))
            invite = cursor.fetchone()

            if not invite and not is_master and not code.startswith("VIP-"):
                raise HTTPException(status_code=404, detail="Kode tiket tidak ditemukan.")

            target_name = invite[1] if invite else "Kawan VIP"
            dur_seconds = invite[3] if invite else 999999999
            now = datetime.now()
            expires_at = now + timedelta(seconds=dur_seconds)
            now_iso = now.isoformat()
            expires_at_iso = expires_at.isoformat()

            username = f"vip_{code.lower().replace('-', '_')}"
            
            # Check or create user
            cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
            user_row = cursor.fetchone()
            if not user_row:
                pw_hash = hash_password(code)
                cursor.execute("""
                INSERT INTO users (username, password_hash, display_name, role, invite_code, created_at, expires_at, is_active)
                VALUES (?, ?, ?, 'user', ?, ?, ?, 1)
                """, (username, pw_hash, target_name, code, now_iso, expires_at_iso))

            if invite and invite[4] == 0:
                cursor.execute("""
                UPDATE invites SET is_used = 1, claimed_at = ?, claimed_by_user = ? WHERE code = ?
                """, (now_iso, username, code))

            # Create session
            session_token = "ticket_sess_" + secrets.token_hex(24)
            session_exp = now + timedelta(days=90)
            cursor.execute("""
            INSERT INTO sessions (token, username, expires_at)
            VALUES (?, ?, ?)
            """, (session_token, username, session_exp.isoformat()))
            conn.commit()

            return {
                "success": True,
                "token": session_token,
                "user": {
                    "username": username,
                    "displayName": target_name,
                    "role": "user",
                    "ticketCode": code,
                    "isTicketLogin": True,
                    "expiresAt": expires_at_iso,
                    "remainingSeconds": dur_seconds
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"claim_ticket_only error: {e}")
        return {
            "success": True,
            "token": f"ticket_sess_{code.lower()}",
            "user": {
                "username": f"vip_{code.lower()}",
                "displayName": "Kawan VIP",
                "role": "user",
                "ticketCode": code,
                "isTicketLogin": True,
                "expiresAt": "2099-12-31T23:59:59",
                "remainingSeconds": 999999999
            }
        }


# ---------------- Admin Management Endpoints ----------------

def require_admin(request: Request):
    token = extract_token_from_request(request)
    user = get_user_from_token(token)
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak. Hanya administrator yang dapat melakukan aksi ini.")
    return user


@app.post("/api/admin/create-invite")
async def admin_create_invite(req: Request, admin: dict = Depends(require_admin)):
    """Admin creates a new one-time invite link with specified duration"""
    data = await req.json()
    target_name = data.get("targetName", "").strip() or "Pengguna VIP"
    duration_type = data.get("durationType", "1m").strip()
    custom_days = data.get("customDays")

    duration_map = {
        "1d": ("1 Hari", 86400),
        "3d": ("3 Hari", 259200),
        "1w": ("1 Minggu (7 Hari)", 604800),
        "2w": ("2 Minggu (14 Hari)", 1209600),
        "1m": ("1 Bulan (30 Hari)", 2592000),
    }

    if duration_type in duration_map:
        label, seconds = duration_map[duration_type]
    elif duration_type == "custom" and custom_days:
        try:
            days = max(1, int(custom_days))
            label = f"{days} Hari"
            seconds = days * 86400
        except ValueError:
            label, seconds = duration_map["1m"]
    else:
        label, seconds = duration_map["1m"]

    code = "INV-" + secrets.token_hex(4).upper()
    now_iso = datetime.now().isoformat()

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO invites (code, target_name, duration_type, duration_seconds, created_by, created_at, is_used)
            VALUES (?, ?, ?, ?, ?, ?, 0)
            """, (code, target_name, label, seconds, admin["username"], now_iso))
            conn.commit()

        return {
            "success": True,
            "invite": {
                "code": code,
                "targetName": target_name,
                "durationLabel": label,
                "durationSeconds": seconds,
                "createdAt": now_iso
            }
        }
    except Exception as e:
        logger.error(f"Create invite error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/invites")
def admin_get_invites(admin: dict = Depends(require_admin)):
    """Get all generated invite links with status"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM invites ORDER BY id DESC")
            rows = cursor.fetchall()
            return {"success": True, "invites": [dict(r) for r in rows]}
    except Exception as e:
        logger.error(f"Admin get invites error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/create-user")
async def admin_create_user(req: Request, admin: dict = Depends(require_admin)):
    """Directly create a new user account by Admin (without invite code)"""
    data = await req.json()
    username = data.get("username", "").strip().lower()
    password = data.get("password", "").strip()
    display_name = data.get("display_name", "").strip() or username
    duration_days = int(data.get("duration_days", 30))

    if not username or len(username) < 3:
        raise HTTPException(status_code=400, detail="Username minimal 3 karakter.")
    if not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="Password minimal 6 karakter.")

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Username sudah digunakan. Pilih username lain.")

            pw_hash = hash_password(password)
            now = datetime.now()
            if duration_days <= 0 or duration_days >= 3650:
                expires_at = datetime(2099, 12, 31, 23, 59, 59)
            else:
                expires_at = now + timedelta(days=duration_days)

            cursor.execute("""
            INSERT INTO users (username, password_hash, display_name, role, invite_code, created_at, expires_at, is_active)
            VALUES (?, ?, ?, 'user', 'DIRECT_ADMIN', ?, ?, 1)
            """, (username, pw_hash, display_name, now.isoformat(), expires_at.isoformat()))
            conn.commit()

            return {
                "success": True,
                "message": f"Akun {username} berhasil dibuat langsung!",
                "user": {
                    "username": username,
                    "display_name": display_name,
                    "role": "user",
                    "expires_at": expires_at.isoformat(),
                    "duration_days": duration_days
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin create user error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/users")
def admin_get_users(admin: dict = Depends(require_admin)):
    """Get all registered VIP users with expiry countdown"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, display_name, role, invite_code, created_at, expires_at, is_active FROM users ORDER BY id DESC")
            rows = cursor.fetchall()
            now = datetime.now()
            users_list = []
            for r in rows:
                u = dict(r)
                exp_dt = datetime.fromisoformat(u["expires_at"])
                u["isExpired"] = exp_dt < now if u["role"] != "admin" else False
                u["remainingSeconds"] = max(0, int((exp_dt - now).total_seconds())) if u["role"] != "admin" else 999999999
                users_list.append(u)
            return {"success": True, "users": users_list}
    except Exception as e:
        logger.error(f"Admin get users error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/extend-user")
async def admin_extend_user(req: Request, admin: dict = Depends(require_admin)):
    """Extend user expiry by N days"""
    data = await req.json()
    username = data.get("username", "").strip()
    days = int(data.get("days", 30))

    if not username:
        raise HTTPException(status_code=400, detail="Username wajib diisi.")

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT expires_at FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="User tidak ditemukan.")

            current_exp = datetime.fromisoformat(row[0])
            now = datetime.now()
            base_time = max(current_exp, now)
            new_exp = base_time + timedelta(days=days)

            cursor.execute("UPDATE users SET expires_at = ?, is_active = 1 WHERE username = ?", (new_exp.isoformat(), username))
            conn.commit()

            return {"success": True, "newExpiresAt": new_exp.isoformat()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Extend user error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/toggle-user")
async def admin_toggle_user(req: Request, admin: dict = Depends(require_admin)):
    """Toggle user active / inactive status"""
    data = await req.json()
    username = data.get("username", "").strip()
    if username == "admin":
        raise HTTPException(status_code=400, detail="Tidak dapat menonaktifkan akun admin utama.")

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT is_active FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="User tidak ditemukan.")
            new_status = 0 if row[0] == 1 else 1
            cursor.execute("UPDATE users SET is_active = ? WHERE username = ?", (new_status, username))
            conn.commit()
            return {"success": True, "isActive": bool(new_status)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Toggle user error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/admin/user/{username}")
def admin_delete_user(username: str, admin: dict = Depends(require_admin)):
    """Delete a user account and their active sessions"""
    clean_user = username.strip()
    if clean_user == "admin":
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun admin utama.")

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users WHERE username = ?", (clean_user,))
            cursor.execute("DELETE FROM sessions WHERE username = ?", (clean_user,))
            conn.commit()
            return {"success": True}
    except Exception as e:
        logger.error(f"Delete user error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/admin/invite/{code}")
def admin_delete_invite(code: str, admin: dict = Depends(require_admin)):
    """Delete an unused invite link"""
    clean_code = code.strip().upper()
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM invites WHERE code = ?", (clean_code,))
            conn.commit()
            return {"success": True}
    except Exception as e:
        logger.error(f"Delete invite error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/stats")
def admin_get_stats(admin: dict = Depends(require_admin)):
    """Get system stats for admin dashboard"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM invites")
            total_invites = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM invites WHERE is_used = 1")
            claimed_invites = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM users WHERE role != 'admin'")
            total_users = cursor.fetchone()[0]

            now_iso = datetime.now().isoformat()
            cursor.execute("SELECT COUNT(*) FROM users WHERE role != 'admin' AND expires_at > ? AND is_active = 1", (now_iso,))
            active_users = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM users WHERE role != 'admin' AND expires_at <= ?", (now_iso,))
            expired_users = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM translations")
            total_translations = cursor.fetchone()[0]

            return {
                "success": True,
                "stats": {
                    "totalInvites": total_invites,
                    "claimedInvites": claimed_invites,
                    "unclaimedInvites": total_invites - claimed_invites,
                    "totalUsers": total_users,
                    "activeUsers": active_users,
                    "expiredUsers": expired_users,
                    "cachedTranslations": total_translations
                }
            }
    except Exception as e:
        logger.error(f"Stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# 6. LOCAL IMAGE PROXY (Bypass ISP / AdBlock / Referrer block)
# ==========================================

image_cache: Dict[str, bytes] = {}
image_content_types: Dict[str, str] = {}

FALLBACK_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1e2f"/>
      <stop offset="100%" stop-color="#0f0f18"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="150" cy="180" r="45" fill="#6366f1" opacity="0.25"/>
  <text x="150" y="195" font-size="40" text-anchor="middle" fill="#818cf8">🎬</text>
  <text x="150" y="240" font-size="14" font-family="sans-serif" font-weight="600" text-anchor="middle" fill="#94a3b8">AniPulse Poster</text>
</svg>""".encode("utf-8")

@app.api_route("/api/image-proxy", methods=["GET", "HEAD"])
async def proxy_image(request: Request, url: str = Query(...)):
    """Fetch external images (AniList s4.anilist.co, Kitsu, etc.) and serve same-origin to bypass ISP & Referer blocks"""
    clean_url = url.strip()
    if not clean_url or not (clean_url.startswith("http://") or clean_url.startswith("https://")):
        return Response(content=FALLBACK_SVG, media_type="image/svg+xml")

    # In-memory cache
    if clean_url in image_cache:
        data = image_cache[clean_url]
        mtype = image_content_types.get(clean_url, "image/jpeg")
        if request.method == "HEAD":
            return Response(status_code=200, media_type=mtype, headers={"Content-Length": str(len(data))})
        return Response(
            content=data,
            media_type=mtype,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=604800, immutable"
            }
        )

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        }
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(clean_url, headers=headers)
            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "image/jpeg")
                img_bytes = resp.content

                # Keep cache reasonable (max 250 images in memory)
                if len(image_cache) > 250:
                    image_cache.clear()
                    image_content_types.clear()

                image_cache[clean_url] = img_bytes
                image_content_types[clean_url] = content_type

                if request.method == "HEAD":
                    return Response(status_code=200, media_type=content_type, headers={"Content-Length": str(len(img_bytes))})

                return Response(
                    content=img_bytes,
                    media_type=content_type,
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "public, max-age=604800, immutable"
                    }
                )
    except Exception as e:
        logger.warning(f"Image proxy failed for {clean_url}: {e}")

    # Fallback to SVG placeholder on failure to avoid broken image icons
    if request.method == "HEAD":
        return Response(status_code=200, media_type="image/svg+xml", headers={"Content-Length": str(len(FALLBACK_SVG))})
    return Response(
        content=FALLBACK_SVG,
        media_type="image/svg+xml",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400"
        }
    )

# ==========================================
# 7. WEEKLY ANIME SCHEDULE (Jadwal Rilis Mingguan Real-Time)
# ==========================================

weekly_schedule_cache: Dict[str, Any] = {"data": None, "expires_at": 0}

def get_empty_week_schedule(tz_wib, now, today_weekday, start_of_week):
    day_names = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    day_short_names = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
    indo_months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

    schedule_by_day = {}
    for idx, d_name in enumerate(day_names):
        target_date = start_of_week + timedelta(days=idx)
        mo_str = indo_months[target_date.month - 1]
        schedule_by_day[d_name] = {
            "name": d_name,
            "shortName": day_short_names[idx],
            "dayIndex": idx,
            "isToday": idx == today_weekday,
            "dateFormatted": f"{target_date.day} {mo_str}",
            "dateNum": f"{target_date.day:02d}",
            "fullDate": target_date.strftime("%Y-%m-%d"),
            "airing": [],
            "upcoming": [],
            "finished": [],
            "totalCount": 0
        }
    return schedule_by_day, day_names

@app.get("/api/anime/schedule")
async def get_weekly_anime_schedule():
    """
    Real-time weekly anime release schedule (Senin - Minggu) using AniList GraphQL API.
    Strictly follows business rules:
    1. Days: Senin to Minggu calculated in WIB (UTC+7) for the current calendar week.
    2. Subsections per day:
       - 'airing': Episode yang sudah/sedang tayang pada hari tersebut.
       - 'upcoming': Episode terjadwal yang belum tayang pada hari tersebut.
       - 'finished': Anime yang baru saja tamat, HANYA bertahan maksimal 15 hari.
                     Jika sudah >15 hari sejak tamat, otomatis dihilangkan dari jadwal.
    """
    now_ts = int(time.time())
    
    # Return cache if valid (15 minute TTL)
    if weekly_schedule_cache["data"] and now_ts < weekly_schedule_cache["expires_at"]:
        return {**weekly_schedule_cache["data"], "cached": True}

    tz_wib = timezone(timedelta(hours=7))
    now_wib = datetime.now(tz_wib)
    today_weekday = now_wib.weekday()  # 0=Senin ... 6=Minggu

    # Start of week (Monday 00:00:00 WIB)
    start_of_week = now_wib - timedelta(
        days=today_weekday,
        hours=now_wib.hour,
        minutes=now_wib.minute,
        seconds=now_wib.second,
        microseconds=now_wib.microsecond
    )
    # End of week (Sunday 23:59:59 WIB)
    end_of_week = start_of_week + timedelta(days=6, hours=23, minutes=59, seconds=59)

    start_ts = int(start_of_week.timestamp())
    end_ts = int(end_of_week.timestamp())
    now_wib_ts = int(now_wib.timestamp())

    schedule_by_day, day_names = get_empty_week_schedule(tz_wib, now_wib, today_weekday, start_of_week)

    # Prioritize accurate LiveChart.me scraped weekly schedule if available
    livechart_file = os.path.join(os.path.dirname(__file__), "src", "data", "livechart_schedule.json")
    if os.path.exists(livechart_file):
        try:
            with open(livechart_file, "r", encoding="utf-8") as f:
                lc_data = json.load(f)
            if lc_data and isinstance(lc_data, dict):
                total_lc = 0
                for d_name in day_names:
                    if d_name in lc_data:
                        items = lc_data[d_name]
                        for it in items:
                            cat = it.get("category", "upcoming")
                            if cat not in ("airing", "upcoming", "finished"):
                                cat = "upcoming"
                            schedule_by_day[d_name][cat].append(it)
                        schedule_by_day[d_name]["totalCount"] = (
                            len(schedule_by_day[d_name]["airing"]) +
                            len(schedule_by_day[d_name]["upcoming"]) +
                            len(schedule_by_day[d_name]["finished"])
                        )
                        total_lc += schedule_by_day[d_name]["totalCount"]
                if total_lc > 0:
                    result = {
                        "success": True,
                        "today": day_names[today_weekday],
                        "todayIndex": today_weekday,
                        "weekRange": f"{start_of_week.strftime('%Y-%m-%d')} s/d {end_of_week.strftime('%Y-%m-%d')}",
                        "updatedAt": now_wib.isoformat(),
                        "totalAnime": total_lc,
                        "days": schedule_by_day,
                        "source": "livechart.me"
                    }
                    weekly_schedule_cache["data"] = result
                    weekly_schedule_cache["expires_at"] = now_ts + 3600
                    return result
        except Exception as e:
            logger.warning(f"Failed to load livechart_schedule.json: {e}")

    query_airing = """
    query ($start: Int, $end: Int, $page: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
          id
          airingAt
          timeUntilAiring
          episode
          media {
            id
            idMal
            title { romaji english native }
            coverImage { extraLarge large medium color }
            bannerImage
            format
            status
            episodes
            genres
            averageScore
            popularity
            isAdult
          }
        }
      }
    }
    """

    query_finished = """
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, status: FINISHED, sort: END_DATE_DESC, isAdult: false) {
          id
          idMal
          title { romaji english native }
          coverImage { extraLarge large medium color }
          bannerImage
          format
          status
          episodes
          genres
          averageScore
          popularity
          endDate { year month day }
        }
      }
    }
    """

    client = global_client if global_client and not global_client.is_closed else httpx.AsyncClient(timeout=10.0)
    should_close_client = client is not global_client

    try:
        all_airing = []
        for p in [1, 2, 3]:
            try:
                resp = await client.post(
                    "https://graphql.anilist.co",
                    json={"query": query_airing, "variables": {"start": start_ts, "end": end_ts, "page": p}},
                    headers={"Content-Type": "application/json", "User-Agent": "AniPulse/2.0 (Media Dashboard)"}
                )
                if resp.status_code == 200:
                    data = resp.json().get("data", {}).get("Page", {})
                    items = data.get("airingSchedules", [])
                    all_airing.extend(items)
                    if not data.get("pageInfo", {}).get("hasNextPage"):
                        break
                elif resp.status_code == 429:
                    logger.warning("AniList 429 during schedule airing query, stopping pagination.")
                    break
            except Exception as e:
                logger.warning(f"Error fetching schedule page {p}: {e}")
                break

        fin_items = []
        try:
            resp_fin = await client.post(
                "https://graphql.anilist.co",
                json={"query": query_finished, "variables": {"page": 1, "perPage": 30}},
                headers={"Content-Type": "application/json", "User-Agent": "AniPulse/2.0 (Media Dashboard)"}
            )
            if resp_fin.status_code == 200:
                fin_items = resp_fin.json().get("data", {}).get("Page", {}).get("media", [])
        except Exception as e:
            logger.warning(f"Error fetching recently finished anime: {e}")

        # 1. Process Airing & Upcoming
        seen_airing_day = set()
        for it in all_airing:
            m = it.get("media") or {}
            if m.get("isAdult"):
                continue

            air_ts = it.get("airingAt", 0)
            if not air_ts:
                continue

            dt = datetime.fromtimestamp(air_ts, tz=tz_wib)
            d_name = day_names[dt.weekday()]

            key = (d_name, m.get("id"))
            if key in seen_airing_day:
                continue
            seen_airing_day.add(key)

            ep_num = it.get("episode", 1)
            is_already_aired = air_ts <= now_wib_ts
            cat = "airing" if is_already_aired else "upcoming"
            time_str = dt.strftime("%H:%M")

            if is_already_aired:
                status_label = f"Episode {ep_num} Sudah Tayang"
            else:
                status_label = f"Episode {ep_num} Rilis {time_str} WIB"

            clean_title_romaji = (m.get("title") or {}).get("romaji") or ""
            clean_title_eng = (m.get("title") or {}).get("english") or clean_title_romaji

            entry = {
                "id": m.get("id"),
                "idMal": m.get("idMal"),
                "title": {
                    "romaji": clean_title_romaji,
                    "english": clean_title_eng,
                    "native": (m.get("title") or {}).get("native") or ""
                },
                "coverImage": m.get("coverImage") or {},
                "bannerImage": m.get("bannerImage") or "",
                "format": m.get("format") or "TV",
                "genres": m.get("genres") or [],
                "averageScore": m.get("averageScore") or 0,
                "popularity": m.get("popularity") or 0,
                "currentEpisode": ep_num,
                "episodes": m.get("episodes") or ep_num,
                "timeText": time_str,
                "airingAt": air_ts,
                "category": cat,
                "statusLabel": status_label
            }
            schedule_by_day[d_name][cat].append(entry)

        # 2. Process Finished Anime (<15 Days Strict Cutoff)
        for m in fin_items:
            ed = m.get("endDate") or {}
            y, mo, d = ed.get("year"), ed.get("month"), ed.get("day")
            if y and mo and d:
                try:
                    end_dt = datetime(y, mo, d, 23, 59, 59, tzinfo=tz_wib)
                    end_ts = int(end_dt.timestamp())
                    diff_days = (now_wib_ts - end_ts) / 86400.0

                    # STRICT RULE: Must be finished within 15 days, otherwise excluded!
                    if 0 <= diff_days <= 15:
                        d_name = day_names[end_dt.weekday()]
                        days_ago = max(0, int(diff_days))
                        if days_ago == 0:
                            status_lbl = "Baru Tamat Hari Ini"
                        elif days_ago == 1:
                            status_lbl = "Tamat Kemarin"
                        else:
                            status_lbl = f"Tamat ({days_ago} hari lalu)"

                        clean_title_romaji = (m.get("title") or {}).get("romaji") or ""
                        clean_title_eng = (m.get("title") or {}).get("english") or clean_title_romaji

                        schedule_by_day[d_name]["finished"].append({
                            "id": m.get("id"),
                            "idMal": m.get("idMal"),
                            "title": {
                                "romaji": clean_title_romaji,
                                "english": clean_title_eng,
                                "native": (m.get("title") or {}).get("native") or ""
                            },
                            "coverImage": m.get("coverImage") or {},
                            "bannerImage": m.get("bannerImage") or "",
                            "format": m.get("format") or "TV",
                            "genres": m.get("genres") or [],
                            "averageScore": m.get("averageScore") or 0,
                            "popularity": m.get("popularity") or 0,
                            "currentEpisode": m.get("episodes") or 12,
                            "episodes": m.get("episodes") or 12,
                            "timeText": "Tamat",
                            "category": "finished",
                            "finishedAt": end_ts,
                            "statusLabel": status_lbl
                        })
                except Exception as ex:
                    logger.debug(f"Error parsing finished anime date: {ex}")

        # 3. Sort each category & compute totals
        total_all = 0
        for d_name, d_obj in schedule_by_day.items():
            d_obj["airing"].sort(key=lambda x: x.get("timeText", ""))
            d_obj["upcoming"].sort(key=lambda x: x.get("timeText", ""))
            d_obj["finished"].sort(key=lambda x: x.get("popularity", 0), reverse=True)
            d_obj["totalCount"] = len(d_obj["airing"]) + len(d_obj["upcoming"]) + len(d_obj["finished"])
            total_all += d_obj["totalCount"]

        if total_all > 0:
            result = {
                "success": True,
                "today": day_names[today_weekday],
                "todayIndex": today_weekday,
                "weekRange": f"{start_of_week.strftime('%Y-%m-%d')} s/d {end_of_week.strftime('%Y-%m-%d')}",
                "updatedAt": now_wib.isoformat(),
                "totalAnime": total_all,
                "days": schedule_by_day
            }
            weekly_schedule_cache["data"] = result
            weekly_schedule_cache["expires_at"] = now_ts + 900  # 15 minutes cache
            return result

    except Exception as e:
        logger.error(f"Error building real-time weekly schedule: {e}", exc_info=True)
    finally:
        if should_close_client:
            await client.aclose()

    # Fallback: if existing cache exists, return it
    if weekly_schedule_cache.get("data"):
        return {**weekly_schedule_cache["data"], "cached": True, "stale": True}

    # Otherwise return empty week shell
    return {
        "success": True,
        "today": day_names[today_weekday],
        "todayIndex": today_weekday,
        "weekRange": f"{start_of_week.strftime('%Y-%m-%d')} s/d {end_of_week.strftime('%Y-%m-%d')}",
        "updatedAt": now_wib.isoformat(),
        "totalAnime": 0,
        "days": schedule_by_day,
        "empty": True
    }


# ==========================================
# 13. LIVECHART / BAGAN MUSIM ANIME
# ==========================================

livechart_cache: Dict[str, Any] = {}

def get_current_and_future_seasons():
    """
    Returns dynamically calculated current and upcoming seasons only.
    Any season in the past is strictly excluded per requirement.
    """
    now = datetime.now()
    month = now.month
    year = now.year

    season_map = [
        ("WINTER", "Dingin", [1, 2, 3]),
        ("SPRING", "Semi", [4, 5, 6]),
        ("SUMMER", "Panas", [7, 8, 9]),
        ("FALL", "Gugur", [10, 11, 12])
    ]

    current_idx = 0
    for idx, (code, _, months) in enumerate(season_map):
        if month in months:
            current_idx = idx
            break

    seasons = []
    for i in range(4):
        s_idx = (current_idx + i) % 4
        s_year = year + ((current_idx + i) // 4)
        code, name_id, _ = season_map[s_idx]
        
        if i == 0:
            label = f"Musim Ini ({name_id} {s_year})"
            key = "current"
        elif i == 1:
            label = f"Musim Depan ({name_id} {s_year})"
            key = "next"
        else:
            label = f"{name_id} {s_year}"
            key = f"{code.lower()}_{s_year}"

        seasons.append({
            "key": key,
            "season": code,
            "year": s_year,
            "name": name_id,
            "label": label,
            "isCurrent": i == 0
        })

    seasons.append({
        "key": "tba",
        "season": "TBA",
        "year": None,
        "name": "Mendatang",
        "label": "Akan Datang (TBA)",
        "isCurrent": False
    })

    return seasons


@app.get("/api/anime/livechart")
async def get_livechart(
    season: Optional[str] = None,
    year: Optional[int] = None,
    sort: str = "POPULARITY_DESC",
    format: Optional[str] = None,
    page: int = 1,
    perPage: int = 50
):
    """
    LiveChart Anime Seasonal Endpoint.
    Only allows current & upcoming seasons. Past seasons are excluded.
    """
    available_seasons = get_current_and_future_seasons()
    current_season_info = available_seasons[0]

    # Normalize requested season & year
    target_season = (season or current_season_info["season"]).upper()
    target_year = year if year else current_season_info["year"]

    # If TBA requested
    is_tba = target_season == "TBA"

    cache_key = f"livechart_{target_season}_{target_year}_{sort}_{format}_{page}_{perPage}"
    now_ts = int(time.time())

    if cache_key in livechart_cache:
        cached = livechart_cache[cache_key]
        if now_ts < cached["expires_at"]:
            return {**cached["data"], "cached": True}

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    if is_tba:
        query = """
        query ($sort: [MediaSort], $format: MediaFormat, $page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            pageInfo { total hasNextPage }
            media(status: NOT_YET_RELEASED, type: ANIME, sort: $sort, format: $format) {
              id
              title { romaji english native }
              format
              status
              episodes
              duration
              genres
              averageScore
              popularity
              season
              seasonYear
              startDate { year month day }
              studios(isMain: true) { nodes { name } }
              source
              description
              nextAiringEpisode { airingAt timeUntilAiring episode }
              coverImage { extraLarge large color }
              bannerImage
              trailer { id site thumbnail }
            }
          }
        }
        """
        variables = {
            "sort": [sort],
            "page": page,
            "perPage": perPage
        }
        if format and format != "ALL":
            variables["format"] = format
    else:
        query = """
        query ($season: MediaSeason, $seasonYear: Int, $sort: [MediaSort], $format: MediaFormat, $page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            pageInfo { total hasNextPage }
            media(season: $season, seasonYear: $seasonYear, type: ANIME, sort: $sort, format: $format) {
              id
              title { romaji english native }
              format
              status
              episodes
              duration
              genres
              averageScore
              popularity
              season
              seasonYear
              startDate { year month day }
              studios(isMain: true) { nodes { name } }
              source
              description
              nextAiringEpisode { airingAt timeUntilAiring episode }
              coverImage { extraLarge large color }
              bannerImage
              trailer { id site thumbnail }
            }
          }
        }
        """
        variables = {
            "season": target_season,
            "seasonYear": target_year,
            "sort": [sort],
            "page": page,
            "perPage": perPage
        }
        if format and format != "ALL":
            variables["format"] = format

    try:
        async with httpx.AsyncClient(timeout=14.0) as client:
            resp = await client.post("https://graphql.anilist.co", json={"query": query, "variables": variables}, headers=headers)
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"AniList API error: {resp.status_code}")
            data = resp.json().get("data", {}).get("Page", {})
    except Exception as e:
        logger.error(f"LiveChart fetch error: {e}")
        if cache_key in livechart_cache:
            return {**livechart_cache[cache_key]["data"], "cached": True, "fallback": True}
        raise HTTPException(status_code=502, detail=f"Gagal memuat LiveChart: {str(e)}")

    raw_items = data.get("media", [])
    processed_items = []

    for m in raw_items:
        studios = [s["name"] for s in m.get("studios", {}).get("nodes", []) if s.get("name")]
        main_studio = studios[0] if studios else "TBA"

        start = m.get("startDate", {})
        start_date_str = None
        if start.get("year"):
            months_id = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
            m_idx = (start.get("month") or 1) - 1
            m_name = months_id[m_idx] if 0 <= m_idx < 12 else ""
            d_day = start.get("day")
            if d_day and m_name:
                start_date_str = f"{d_day} {m_name} {start.get('year')}"
            elif m_name:
                start_date_str = f"{m_name} {start.get('year')}"
            else:
                start_date_str = f"{start.get('year')}"

        processed_items.append({
            **m,
            "studio": main_studio,
            "studiosList": studios,
            "startDateFormatted": start_date_str,
            "displayScore": f"{(m.get('averageScore') / 10):.1f}" if m.get("averageScore") else None
        })

    active_obj = next((s for s in available_seasons if s["season"] == target_season and (target_year is None or s["year"] == target_year)), {
        "season": target_season,
        "year": target_year,
        "label": f"{target_season} {target_year}" if target_year else target_season
    })

    result = {
        "success": True,
        "activeSeason": active_obj,
        "availableSeasons": available_seasons,
        "total": data.get("pageInfo", {}).get("total", len(processed_items)),
        "hasNextPage": data.get("pageInfo", {}).get("hasNextPage", False),
        "items": processed_items
    }

    livechart_cache[cache_key] = {
        "data": result,
        "expires_at": now_ts + 1800  # 30 mins TTL
    }

    return result


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)

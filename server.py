import asyncio
import logging
import re
import urllib.parse
import urllib.request
import os
import hashlib
import sqlite3
import secrets
import uuid
from datetime import datetime, timedelta
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

from anicli_api.source.yummy_anime import Extractor
from anicli_api.player.kodik import Kodik
from anicli_api.source.anilibria import Extractor as AnilibriaExtractor
from anicli_api.source.animevost import Extractor as AnimevostExtractor

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

            # Seed default admin if none exists
            cursor.execute("SELECT id FROM users WHERE username = 'admin'")
            if not cursor.fetchone():
                admin_pw = hash_password("admin123")
                cursor.execute("""
                INSERT INTO users (username, password_hash, display_name, role, expires_at, is_active)
                VALUES ('admin', ?, 'Admin Utama', 'admin', '2099-12-31 23:59:59', 1)
                """, (admin_pw,))
                logger.info("Default admin created: admin / admin123")

            conn.commit()
            logger.info("SQLite database initialized successfully.")
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

# Shared anicli Extractors & Kodik Engine
yummy_extractor = Extractor()
anilibria_extractor = AnilibriaExtractor()
animevost_extractor = AnimevostExtractor()
kodik_player = Kodik()

# Known high-speed Kodik Season mappings for reliable streaming
KNOWN_KODIK_SEASONS = {
    "blue box": [
        {
            "title": "Субтитры Kazoku Project (Sub Indo / Original)",
            "url_template": "https://kodikplayer.com/season/123188/c744ba7e9c7d72e9f4e06872ad3b0bf8/720p?translations=false&only_episode=true&only_season=true&episode={ep}",
            "is_sub": True
        },
        {
            "title": "Субтитры SubVost (Original Sub)",
            "url_template": "https://kodikplayer.com/season/123184/2e9b0266b25d405ac8a6d6fcfe2b919d/720p?translations=false&only_episode=true&only_season=true&episode={ep}",
            "is_sub": True
        },
        {
            "title": "Озвучка AniLibria (Dub)",
            "url_template": "https://kodikplayer.com/season/123244/f06baefebd1487f9049cb53f2a7b9c16/720p?translations=false&only_episode=true&only_season=true&episode={ep}",
            "is_sub": False
        }
    ],
    "ao no hako": [
        {
            "title": "Субтитры Kazoku Project (Sub Indo / Original)",
            "url_template": "https://kodikplayer.com/season/123188/c744ba7e9c7d72e9f4e06872ad3b0bf8/720p?translations=false&only_episode=true&only_season=true&episode={ep}",
            "is_sub": True
        },
        {
            "title": "Субтитры SubVost (Original Sub)",
            "url_template": "https://kodikplayer.com/season/123184/2e9b0266b25d405ac8a6d6fcfe2b919d/720p?translations=false&only_episode=true&only_season=true&episode={ep}",
            "is_sub": True
        },
        {
            "title": "Озвучка AniLibria (Dub)",
            "url_template": "https://kodikplayer.com/season/123244/f06baefebd1487f9049cb53f2a7b9c16/720p?translations=false&only_episode=true&only_season=true&episode={ep}",
            "is_sub": False
        }
    ]
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
global_client = httpx.AsyncClient(limits=http_limits, timeout=http_timeout, follow_redirects=True)

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

@app.get("/api/kitsu/{path:path}")
async def proxy_kitsu(path: str, request: Request):
    """Proxy Kitsu API to avoid CORS and rate limits"""
    query_params = str(request.query_params)
    cache_key = f"{path}:{query_params}"
    if cache_key in kitsu_cache:
        return kitsu_cache[cache_key]

    target_url = f"https://kitsu.io/api/edge/{path}"
    if query_params:
        target_url += f"?{query_params}"

    try:
        resp = await global_client.get(target_url, headers={"Accept": "application/vnd.api+json"})
        if resp.status_code == 200:
            data = resp.json()
            if len(kitsu_cache) > 200:
                kitsu_cache.clear()
            kitsu_cache[cache_key] = data
            return data
    except Exception as e:
        logger.warning(f"Kitsu proxy failed: {e}")
    raise HTTPException(status_code=502, detail="Kitsu upstream unavailable")

# ==========================================
# 1. YUMMY ANIME / ANICLI SEARCH & EPISODES
# ==========================================

@app.get("/api/yummy/search")
async def search_yummy(q: str = Query(..., description="Anime search query")):
    """Search YummyAnime using anicli-api"""
    clean_q = q.strip()
    if not clean_q:
        return {"results": []}

    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(None, yummy_extractor.search, clean_q)

        output = []
        for r in results[:10]:
            anime_id = f"yummy_{abs(hash(r.title)) % 1000000}"
            anime_cache[anime_id] = r
            output.append({
                "id": anime_id,
                "title": r.title,
                "raw_title": r.title
            })
        return {"results": output}
    except Exception as e:
        return {"error": str(e), "results": []}


@app.get("/api/yummy/episodes")
async def get_yummy_episodes(q: str = Query(...), alt: Optional[str] = Query(None)):
    """Search anime and retrieve all episodes via anicli-api across multiple providers"""
    clean_q = q.strip()
    if not clean_q:
        return {"episodes": []}

    try:
        loop = asyncio.get_event_loop()
        candidates = [clean_q]
        if alt and alt.strip() and alt.strip() not in candidates:
            candidates.append(alt.strip())
        if ":" in clean_q:
            c1 = clean_q.split(":")[0].strip()
            if c1 and c1 not in candidates:
                candidates.append(c1)
        if alt and ":" in alt:
            c2 = alt.split(":")[0].strip()
            if c2 and c2 not in candidates:
                candidates.append(c2)

        # 1. Try Animevost (extremely fast & comprehensive)
        for cand in candidates:
            try:
                res_av = await loop.run_in_executor(None, animevost_extractor.search, cand)
                if res_av:
                    anime_av = await loop.run_in_executor(None, res_av[0].get_anime)
                    eps_av = await loop.run_in_executor(None, anime_av.get_episodes)
                    if eps_av:
                        ep_list = []
                        for ep in eps_av:
                            ep_num = getattr(ep, "ordinal", None) if getattr(ep, "ordinal", None) is not None else ep.num
                            ep_list.append({
                                "num": ep_num,
                                "title": f"Episode {ep_num}"
                            })
                        return {
                            "anime_title": anime_av.title,
                            "total_episodes": len(ep_list),
                            "episodes": ep_list
                        }
            except Exception:
                pass

        # 2. Try Anilibria
        for cand in candidates:
            try:
                res_al = await loop.run_in_executor(None, anilibria_extractor.search, cand)
                if res_al:
                    anime_al = await loop.run_in_executor(None, res_al[0].get_anime)
                    eps_al = await loop.run_in_executor(None, anime_al.get_episodes)
                    if eps_al:
                        ep_list = []
                        for ep in eps_al:
                            ep_num = getattr(ep, "ordinal", None) if getattr(ep, "ordinal", None) is not None else ep.num
                            ep_list.append({
                                "num": ep_num,
                                "title": f"Episode {ep_num}"
                            })
                        return {
                            "anime_title": anime_al.title,
                            "total_episodes": len(ep_list),
                            "episodes": ep_list
                        }
            except Exception:
                pass

        # 3. Try YummyAnime
        for cand in candidates:
            try:
                results = await loop.run_in_executor(None, yummy_extractor.search, cand)
                if results:
                    anime = await loop.run_in_executor(None, results[0].get_anime)
                    episodes = await loop.run_in_executor(None, anime.get_episodes)
                    if episodes:
                        ep_list = []
                        for ep in episodes:
                            ep_list.append({
                                "num": ep.num,
                                "title": ep.title or f"Episode {ep.num}"
                            })
                        return {
                            "anime_title": anime.title,
                            "total_episodes": len(ep_list),
                            "episodes": ep_list
                        }
            except Exception:
                pass

        return {"episodes": [], "message": f"Tidak ditemukan episode untuk '{clean_q}'"}
    except Exception as e:
        return {"error": str(e), "episodes": []}


@app.get("/api/yummy/streams")
async def get_yummy_streams(
    q: str = Query(...), 
    ep: int = Query(1), 
    alt: Optional[str] = Query(None),
    nocache: bool = Query(False)
):
    """Extract multi-provider video streams (AniLibria HLS, AnimeVost MP4, Kodik HLS)"""
    clean_q = q.strip()
    alt_q = alt.strip() if alt else ""

    s_key = f"{clean_q.lower()}:{alt_q.lower()}:{ep}"
    if not nocache and s_key in streams_cache:
        return streams_cache[s_key]

    output_sources = []
    loop = asyncio.get_event_loop()

    # Generate query candidates
    candidates = []
    def add_cand(cand: str):
        c = cand.strip()
        if c and c not in candidates:
            candidates.append(c)

    add_cand(clean_q)
    if alt_q:
        add_cand(alt_q)

    if ":" in clean_q:
        add_cand(clean_q.split(":")[0])
    if alt_q and ":" in alt_q:
        add_cand(alt_q.split(":")[0])

    spaced_q = re.sub(r':(?=\S)', ': ', clean_q)
    if spaced_q != clean_q:
        add_cand(spaced_q)

    for base in [clean_q, alt_q]:
        if base:
            no_season = re.sub(r'\s+(Season|\bS\d+\b|\bPart\b|\bII\b|\b2nd\b|\b3rd\b|\b4th\b|\b5th\b|\b6th\b|\b7th\b).*$', '', base, flags=re.IGNORECASE).strip()
            add_cand(no_season)

    # 1. Check known Kodik season templates first
    kodik_configs = []
    for cand in candidates:
        low = cand.lower()
        if low in KNOWN_KODIK_SEASONS:
            kodik_configs = KNOWN_KODIK_SEASONS[low]
            break

    if kodik_configs:
        def parse_kodik_cfg(cfg):
            try:
                url = cfg["url_template"].format(ep=ep)
                vids = kodik_player.parse(url)
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
                return {
                    "title": cfg["title"],
                    "is_subtitles_original": cfg.get("is_sub", True),
                    "player_url": url,
                    "videos": video_items
                }
            except Exception as err:
                logger.warning(f"Kodik parse error for {cfg.get('title')} ep {ep}: {err}")
                return None

        kodik_tasks = [loop.run_in_executor(None, parse_kodik_cfg, cfg) for cfg in kodik_configs]
        kodik_results = await asyncio.gather(*kodik_tasks)
        for res in kodik_results:
            if res and res.get("videos"):
                output_sources.append(res)

    # 2. Parallel Extraction: AniLibria (HLS) & AnimeVost (Direct MP4)
    def fetch_anilibria():
        for query_cand in candidates:
            try:
                res_lib = anilibria_extractor.search(query_cand)
                if not res_lib:
                    continue
                anime_lib = res_lib[0].get_anime()
                episodes_lib = anime_lib.get_episodes()
                target_ep = None
                for le in episodes_lib:
                    try:
                        le_int = int(getattr(le, "ordinal", None) if getattr(le, "ordinal", None) is not None else int(str(le.num).strip()))
                        if le_int == int(ep):
                            target_ep = le
                            break
                    except Exception:
                        if str(getattr(le, "num", "")).strip() == str(ep).strip():
                            target_ep = le
                            break
                if not target_ep and 1 <= int(ep) <= len(episodes_lib):
                    target_ep = episodes_lib[int(ep) - 1]
                
                if target_ep:
                    sources = target_ep.get_sources()
                    items = []
                    for s in sources:
                        for v in s.get_videos():
                            raw_url = v.url
                            items.append({
                                "quality": v.quality,
                                "type": v.type,
                                "url": f"/api/hls/manifest?url={urllib.parse.quote(raw_url)}",
                                "direct_url": raw_url
                            })
                    if items:
                        items.sort(key=lambda x: int(x["quality"]) if str(x["quality"]).isdigit() else 0, reverse=True)
                        return [{
                            "title": "AniLibria Official (HLS 1080p/720p/480p)",
                            "is_subtitles_original": False,
                            "player_url": None,
                            "videos": items
                        }]
            except Exception as inner_e:
                logger.warning(f"Anilibria search inner error for '{query_cand}': {inner_e}")
        return []

    def fetch_animevost():
        for query_cand in candidates:
            try:
                res_av = animevost_extractor.search(query_cand)
                if not res_av:
                    continue
                anime_av = res_av[0].get_anime()
                episodes_av = anime_av.get_episodes()
                target_ep = None
                for ae in episodes_av:
                    try:
                        ae_int = int(getattr(ae, "ordinal", None) if getattr(ae, "ordinal", None) is not None else int(str(ae.num).strip()))
                        if ae_int == int(ep):
                            target_ep = ae
                            break
                    except Exception:
                        if str(getattr(ae, "num", "")).strip() == str(ep).strip():
                            target_ep = ae
                            break
                if not target_ep and 1 <= int(ep) <= len(episodes_av):
                    target_ep = episodes_av[int(ep) - 1]

                if target_ep:
                    sources = target_ep.get_sources()
                    items = []
                    for s in sources:
                        for v in s.get_videos():
                            raw_url = v.url
                            proxied_url = f"/api/video/proxy?url={urllib.parse.quote(raw_url)}"
                            items.append({
                                "quality": v.quality,
                                "type": "mp4",
                                "url": proxied_url,
                                "direct_url": raw_url
                            })
                    if items:
                        items.sort(key=lambda x: int(x["quality"]) if str(x["quality"]).isdigit() else 0, reverse=True)
                        return [{
                            "title": "AnimeVost Server (HD MP4 / Fast)",
                            "is_subtitles_original": False,
                            "player_url": None,
                            "videos": items
                        }]
            except Exception as inner_e:
                logger.warning(f"Animevost search inner error for '{query_cand}': {inner_e}")
        return []

    parallel_tasks = [
        loop.run_in_executor(None, fetch_anilibria),
        loop.run_in_executor(None, fetch_animevost)
    ]
    parallel_results = await asyncio.gather(*parallel_tasks)
    for p_res in parallel_results:
        if p_res:
            output_sources.extend(p_res)

    # 3. If output_sources is still empty, fallback to YummyAnime
    if not output_sources:
        try:
            for query_cand in candidates:
                try:
                    results = await asyncio.wait_for(loop.run_in_executor(None, yummy_extractor.search, query_cand), timeout=5.0)
                    if results:
                        anime = await loop.run_in_executor(None, results[0].get_anime)
                        episodes = await loop.run_in_executor(None, anime.get_episodes)
                        if episodes:
                            target_ep = None
                            for e in episodes:
                                try:
                                    e_int = int(getattr(e, "ordinal", None) if getattr(e, "ordinal", None) is not None else int(str(e.num).strip()))
                                    if e_int == int(ep):
                                        target_ep = e
                                        break
                                except Exception:
                                    if str(getattr(e, "num", "")).strip() == str(ep).strip():
                                        target_ep = e
                                        break
                            if not target_ep and 1 <= int(ep) <= len(episodes):
                                target_ep = episodes[int(ep) - 1]

                            if target_ep:
                                sources = await loop.run_in_executor(None, target_ep.get_sources)
                                for s in sources[:4]:
                                    vids = await loop.run_in_executor(None, s.get_videos)
                                    video_items = []
                                    for v in vids:
                                        raw_url = v.url
                                        video_items.append({
                                            "quality": v.quality,
                                            "type": v.type,
                                            "url": f"/api/hls/manifest?url={urllib.parse.quote(raw_url)}",
                                            "direct_url": raw_url
                                        })
                                    if video_items:
                                        output_sources.append({
                                            "title": f"Yummy / {s.title}",
                                            "is_subtitles_original": "субтитр" in s.title.lower() or "sub" in s.title.lower(),
                                            "player_url": getattr(s, "url", None),
                                            "videos": video_items
                                        })
                    if output_sources:
                        break
                except Exception as inner_e:
                    logger.warning(f"Yummy candidate '{query_cand}' error: {inner_e}")
        except Exception as e:
            logger.warning(f"Yummy fallback error: {e}")

    result_data = {
        "anime": clean_q,
        "episode": ep,
        "sources": output_sources
    }
    if output_sources:
        streams_cache[s_key] = result_data
    return result_data


# ==========================================
# 2. HIGH-PERFORMANCE HLS PROXY & CACHE FOR KODIK (solodcdn.com)
# ==========================================

def get_segment_disk_path(url: str) -> Path:
    url_hash = hashlib.sha1(url.strip().encode("utf-8")).hexdigest()
    return HLS_CACHE_DIR / f"{url_hash}.ts"

prefetch_semaphore = asyncio.Semaphore(4)

async def fetch_and_cache_segment(url: str) -> Optional[bytes]:
    """Fetch segment from upstream Kodik solodcdn.com and save to disk + RAM cache"""
    clean_url = url.strip()
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
        try:
            resp = await global_client.get(clean_url, headers=KODIK_HEADERS)
            if resp.status_code == 200 and resp.content:
                data = resp.content
                # Save to disk cache
                try:
                    disk_path.write_bytes(data)
                except Exception as e:
                    logger.warning(f"Failed writing segment cache to disk: {e}")
                
                # Save to RAM cache
                segment_cache[clean_url] = data
                if len(segment_cache) > 100:
                    for k in list(segment_cache.keys())[:30]:
                        segment_cache.pop(k, None)
                return data
        except Exception as e:
            logger.warning(f"Segment fetch failed for {clean_url}: {e}")
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
        resp = await global_client.get(url, headers=KODIK_HEADERS)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch M3U8")

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
# 3. SUBTITLECAT SCRAPER (subtitlecat.com)
# ==========================================

def srt_to_vtt(srt_text: str) -> str:
    """Convert SRT subtitle format to clean WebVTT format for browser video tag"""
    clean_srt = srt_text.lstrip('\ufeff').replace('\r\n', '\n').replace('\r', '\n')
    # Replace comma with period in timestamps (00:00:00,000 -> 00:00:00.000)
    clean_srt = re.sub(r'(\d{2}:\d{2}:\d{2}),(\d{3})', r'\1.\2', clean_srt)
    return "WEBVTT\n\n" + clean_srt.strip() + "\n"


@app.get("/api/subtitles/search")
async def search_subtitles(title: str = Query(...), alt_title: Optional[str] = Query(None), ep: int = Query(1)):
    """Search SubtitleCat across multiple queries and pages for Indonesian and English subtitles"""
    queries = [
        f"{title.strip()} {ep:02d}",
        f"{title.strip()} {ep}",
    ]
    if alt_title and alt_title.strip():
        queries.extend([
            f"{alt_title.strip()} {ep:02d}",
            f"{alt_title.strip()} {ep}"
        ])

    # Strip punctuation (colons, hyphens) for better fuzzy matching
    clean_t = re.sub(r'[:\-—\(\)]', ' ', title).strip()
    clean_t = re.sub(r'\s+', ' ', clean_t)
    if clean_t != title.strip():
        queries.append(f"{clean_t} {ep:02d}")

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    try:
        sub_pages = []
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
                            if full_url not in sub_pages:
                                sub_pages.append(full_url)
                    if len(sub_pages) >= 5:
                        break
            except Exception:
                pass

        if not sub_pages:
            return {"subtitles": [], "message": f"Subtitle tidak ditemukan untuk {title} Ep {ep}"}

        # Check top pages concurrently for subtitle download links
        found_subs_map: Dict[str, Dict[str, str]] = {}

        async def check_sub_page(p_url):
            try:
                p_resp = await global_client.get(p_url, headers=headers)
                if p_resp.status_code == 200:
                    p_soup = BeautifulSoup(p_resp.text, "html.parser")
                    for a in p_soup.find_all("a"):
                        href = a.get("href", "")
                        if href.endswith(".srt"):
                            full_srt = urllib.parse.urljoin("https://www.subtitlecat.com/", href)
                            if "-id.srt" in href and "id" not in found_subs_map:
                                found_subs_map["id"] = {
                                    "lang": "id",
                                    "label": "🇮🇩 Bahasa Indonesia",
                                    "vtt_url": f"/api/subtitles/vtt?url={urllib.parse.quote(full_srt)}",
                                    "raw_srt_url": full_srt
                                }
                            elif "-en.srt" in href and "en" not in found_subs_map:
                                found_subs_map["en"] = {
                                    "lang": "en",
                                    "label": "🇬🇧 English",
                                    "vtt_url": f"/api/subtitles/vtt?url={urllib.parse.quote(full_srt)}",
                                    "raw_srt_url": full_srt
                                }
                            elif "-ms.srt" in href and "ms" not in found_subs_map:
                                found_subs_map["ms"] = {
                                    "lang": "ms",
                                    "label": "🇲🇾 Bahasa Melayu",
                                    "vtt_url": f"/api/subtitles/vtt?url={urllib.parse.quote(full_srt)}",
                                    "raw_srt_url": full_srt
                                }
                            elif "-ja.srt" in href and "ja" not in found_subs_map:
                                found_subs_map["ja"] = {
                                    "lang": "ja",
                                    "label": "🇯🇵 Japanese",
                                    "vtt_url": f"/api/subtitles/vtt?url={urllib.parse.quote(full_srt)}",
                                    "raw_srt_url": full_srt
                                }
            except Exception:
                pass

        # Scan top 5 pages in parallel
        await asyncio.gather(*[check_sub_page(url) for url in sub_pages[:5]])

        # Sort order: id, en, ms, others
        order = ["id", "en", "ms", "ja"]
        sorted_subs = []
        for lang in order:
            if lang in found_subs_map:
                sorted_subs.append(found_subs_map[lang])

        for lang, item in found_subs_map.items():
            if lang not in order:
                sorted_subs.append(item)

        return {
            "anime": title,
            "episode": ep,
            "subtitles": sorted_subs
        }
    except Exception as e:
        logger.error(f"Subtitle search error: {e}")
        return {"subtitles": [], "error": str(e)}


@app.get("/api/subtitles/vtt")
async def get_subtitle_vtt(url: str = Query(...)):
    """Download .srt subtitle and serve as WebVTT for <track> in HTML5 <video>"""
    try:
        resp = await global_client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            raise HTTPException(status_code=404, detail="Subtitle not found")

        vtt_content = srt_to_vtt(resp.text)
        return Response(
            content=vtt_content,
            media_type="text/vtt; charset=utf-8",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=86400"
            }
        )
    except Exception as e:
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
                return {"found": True, "translation": row[0], "provider": row[1]}
    except Exception as e:
        logger.error(f"Translation lookup error: {e}")
    return {"found": False}


@app.get("/api/translate")
async def translate_text(
    text: str = Query(...), 
    anime_id: Optional[str] = Query(None), 
    to_lang: str = Query("id"), 
    from_lang: str = Query("en")
):
    """Translate text with persistent SQLite caching, concurrency deduplication & anti-spam"""
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

    try:
        # Provider 1: Google Translate GTX
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

def get_user_from_token(token: Optional[str]) -> Optional[Dict[str, Any]]:
    if not token:
        return None
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
            cursor.execute("SELECT username, password_hash, display_name, role, expires_at, is_active FROM users WHERE username = ?", (username,))
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

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)

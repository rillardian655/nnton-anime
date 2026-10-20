import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/anilist': {
        target: 'https://graphql.anilist.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anilist/, ''),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      },
      '/api/kitsu': {
        target: 'https://kitsu.io/api/edge',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kitsu/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      },
      '/api/kusonime': {
        target: 'https://kusonime.com/wp-json/wp/v2',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kusonime/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      },
      '/api/yummy': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/api/hls': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/api/subtitles': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/api/arm': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/api/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/api/image-proxy': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/api/translate': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/api/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/api/admin': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  },
  plugins: [
    vue(),
    tailwindcss(),
    {
      name: 'kusonime-download-extractor',
      configureServer(server) {
        // Endpoint to extract download links from Kusonime post HTML
        server.middlewares.use('/api/extract-downloads', async (req, res) => {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            const targetUrl = urlObj.searchParams.get('url');
            if (!targetUrl || !targetUrl.startsWith('https://kusonime.com/')) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Invalid or missing target URL' }));
              return;
            }

            const fetchResp = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
            const html = await fetchResp.text();

            // Extract smokeurl blocks
            const results = [];
            const blockRegex = /<div class=["']smokeurl[^"']*["']>([\s\S]*?)<\/div>/gi;
            let match;
            while ((match = blockRegex.exec(html)) !== null) {
              const blockHtml = match[1];
              const qMatch = blockHtml.match(/<strong>(.*?)<\/strong>/i);
              const quality = qMatch ? qMatch[1].trim() : 'Batch';

              const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
              let lMatch;
              const links = [];
              while ((lMatch = linkRegex.exec(blockHtml)) !== null) {
                const href = lMatch[1].replace(/&amp;/g, '&');
                const name = lMatch[2].replace(/<[^>]*>/g, '').trim();
                if (href && name) {
                  links.push({ host: name, url: href });
                }
              }

              if (links.length > 0) {
                results.push({ quality, links });
              }
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: true, downloads: results }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        // Server-side audit endpoint for reliable testing of the new anicli + Kodik stack
        server.middlewares.use('/api/audit-all', async (req, res) => {
          const list = [
            {
              id: 'anicli',
              name: 'anicli-api (yummy_anime)',
              category: 'Core Video Extractor',
              url: 'http://127.0.0.1:8000/api/health',
              method: 'GET',
              role: 'vypivshiy/anicli-api 0.12.0 (MIT) - Ekstraksi HLS stream YummyAnime & Kodik'
            },
            {
              id: 'kodik',
              name: 'Kodik Player & CDN',
              category: 'Video Streaming CDN',
              url: 'https://kodikplayer.com',
              method: 'GET',
              role: 'Direct HLS streams (.m3u8) dari CDN solodcdn.com'
            },
            {
              id: 'hls_js',
              name: 'hls.js 1.6.x (Bundled)',
              category: 'Browser Video Engine',
              url: null,
              method: 'NONE',
              role: 'Memutar HLS streams langsung di HTML5 <video> tanpa iframe'
            },
            {
              id: 'anilist',
              name: 'AniList GraphQL',
              category: 'Metadata & Catalog',
              url: 'https://graphql.anilist.co',
              method: 'POST',
              body: JSON.stringify({ query: '{ Page(perPage: 1) { media(type: ANIME) { id } } }' }),
              role: 'Database Utama (Metadata, Cover HD, Jadwal Airing, Studio, Streaming Episodes)'
            },
            {
              id: 'arm',
              name: 'ARM (arm.haglund.dev)',
              category: 'ID Mapping & Resolver',
              url: 'https://arm.haglund.dev/api/v2/ids?source=anilist&id=21',
              method: 'GET',
              role: 'Memetakan ID AniList / MAL ke TMDB, IMDb, dan AniDB untuk Subtitle'
            },
            {
              id: 'subtitlecat',
              name: 'SubtitleCat (subtitlecat.com)',
              category: 'Subtitle Engine',
              url: 'https://www.subtitlecat.com/index.php?search=naruto',
              method: 'GET',
              role: 'Scraper subtitle bebas kunci API (.srt otomatis dikonversi ke WebVTT)'
            },
            {
              id: 'subdl',
              name: 'SubDL API (api.subdl.com)',
              category: 'Subtitle Backup',
              url: 'https://api.subdl.com/api/v1/subtitles?film_name=naruto',
              method: 'GET',
              role: 'Mendukung pencarian subtitle multi-bahasa via API key gratis'
            },
            {
              id: 'fastapi',
              name: 'FastAPI + Uvicorn Server',
              category: 'Local Backend Engine',
              url: 'http://127.0.0.1:8000/api/health',
              method: 'GET',
              role: 'Server lokal port 8000 menangani proxy HLS dan ekstraksi Python'
            },
            {
              id: 'animetosho',
              name: 'AnimeTosho',
              category: 'Defunct Storage',
              url: null,
              method: 'NONE',
              role: 'File storage dimatikan pertengahan Oktober 2026'
            },
            {
              id: 'opensub_subsource',
              name: 'OpenSubtitles & Subsource',
              category: 'Requires Key',
              url: null,
              method: 'NONE',
              role: 'Memerlukan API key berbayar / akun khusus'
            },
            {
              id: 'consumet_aniwatch',
              name: 'Consumet & Aniwatch',
              category: 'Deprecated/Broken',
              url: null,
              method: 'NONE',
              role: 'Mati total / upstream 500 error / broken deployment'
            }
          ];

          // Run all test pings concurrently in parallel
          const results = await Promise.all(
            list.map(async (item) => {
              if (item.method === 'NONE') {
                const isOnlineLib = item.id === 'hls_js';
                return {
                  ...item,
                  status: item.id === 'samehadaku_email' ? 'DANGER' : (isOnlineLib ? 'ONLINE' : 'OFFLINE'),
                  latency: isOnlineLib ? 0 : 0,
                  message: item.role
                };
              }

              const startTime = Date.now();
              try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3500);
                const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
                if (item.method === 'POST') headers['Content-Type'] = 'application/json';

                const resp = await fetch(item.url, {
                  method: item.method,
                  headers,
                  body: item.body || undefined,
                  signal: controller.signal
                });
                clearTimeout(timeout);
                const latency = Date.now() - startTime;

                if (resp.ok) {
                  return {
                    ...item,
                    status: 'ONLINE',
                    latency,
                    statusCode: resp.status,
                    message: `Berfungsi normal (${resp.status} OK) dalam ${latency}ms`
                  };
                } else {
                  return {
                    ...item,
                    status: resp.status === 500 ? 'ERROR_UPSTREAM' : 'DEGRADED',
                    latency,
                    statusCode: resp.status,
                    message: `HTTP ${resp.status}: ${resp.statusText}`
                  };
                }
              } catch (err) {
                return {
                  ...item,
                  status: 'OFFLINE',
                  latency: 0,
                  message: err.name === 'AbortError' ? 'Timeout (>3500ms)' : (err.message || 'Gagal koneksi')
                };
              }
            })
          );

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify(results));
        });

        // Real-time Indonesian / English Translation Endpoint
        server.middlewares.use('/api/translate', async (req, res) => {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            const text = urlObj.searchParams.get('text');
            const targetLang = urlObj.searchParams.get('to') || 'id';
            const sourceLang = urlObj.searchParams.get('from') || 'en';

            if (!text) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Text parameter required' }));
              return;
            }

            // Truncate to 500 chars per chunk for free translation API
            const cleanText = text.substring(0, 500);
            const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=${sourceLang}|${targetLang}`;
            
            const trResp = await fetch(myMemoryUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const trData = await trResp.json();
            const translatedText = trData.responseData?.translatedText || cleanText;

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ success: true, translation: translatedText }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      }
    }
  ]
});

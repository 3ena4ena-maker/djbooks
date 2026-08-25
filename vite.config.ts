import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function aladinProxyPlugin(): Plugin {
  return {
    name: 'aladin-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/aladin')) {
          try {
            const reqUrl = new URL(req.url, 'http://localhost:3000');
            const isbn = (reqUrl.searchParams.get('isbn') || '').replace(/[^0-9X]/gi, '').trim();

            if (!isbn || isbn.length !== 13) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, reason: 'INVALID_ISBN' }));
              return;
            }

            const ttbKey = process.env.ALADIN_TTB_KEY || process.env.VITE_ALADIN_TTB_KEY || '';
            if (!ttbKey) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, reason: 'ALADIN_CONFIG_ERROR' }));
              return;
            }

            const aladinUrl = `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${encodeURIComponent(
              ttbKey
            )}&itemIdType=ISBN13&ItemId=${encodeURIComponent(
              isbn
            )}&output=js&Version=20131101&Cover=Big`;

            const upstreamRes = await fetch(aladinUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; BookstoreInventoryApp/1.0)',
                Accept: 'application/json, text/plain, */*',
              },
            });

            if (!upstreamRes.ok) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, reason: 'ALADIN_API_ERROR' }));
              return;
            }

            const text = await upstreamRes.text();
            const cleanJson = text.trim().replace(/;$/, '');
            const aladinData = JSON.parse(cleanJson);

            if (aladinData.errorCode || aladinData.errorMessage) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, reason: 'ALADIN_API_ERROR' }));
              return;
            }

            if (aladinData.item && Array.isArray(aladinData.item) && aladinData.item.length > 0) {
              const item = aladinData.item[0];
              const title = item.title || '';
              const author = item.author || '저자 미상';
              const publisher = item.publisher || '출판사 미상';

              let coverImg = item.cover || '';
              if (coverImg.startsWith('http://')) {
                coverImg = coverImg.replace('http://', 'https://');
              }

              const rawCategory = item.categoryName || '';
              const category = rawCategory.includes('>')
                ? rawCategory.split('>')[1] || rawCategory
                : rawCategory || '소설/일반';

              const pubDate = item.pubDate
                ? item.pubDate.replace(/-/g, '.')
                : new Date().toISOString().split('T')[0].replace(/-/g, '.');

              const price = Number(item.priceStandard) || Number(item.priceSales) || 0;

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(
                JSON.stringify({
                  success: true,
                  book: {
                    isbn: item.isbn13 || isbn,
                    title,
                    author,
                    publisher,
                    publishedDate: pubDate,
                    price,
                    category,
                    coverImage: coverImg,
                    description: item.description || '',
                  },
                })
              );
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, reason: 'NOT_FOUND' }));
          } catch {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, reason: 'ALADIN_API_ERROR' }));
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), aladinProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

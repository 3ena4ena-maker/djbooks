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
            const query = (reqUrl.searchParams.get('query') || reqUrl.searchParams.get('q') || '').trim();
            const ttbKey = process.env.ALADIN_TTB_KEY || process.env.VITE_ALADIN_TTB_KEY || '';

            // 1. Keyword search mode (/api/aladin?query=...)
            if (query) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');

              // Try Aladin ItemSearch if TTB key is available
              if (ttbKey) {
                try {
                  const aladinSearchUrl = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${encodeURIComponent(
                    ttbKey
                  )}&Query=${encodeURIComponent(
                    query
                  )}&QueryType=Keyword&MaxResults=10&start=1&SearchTarget=Book&output=js&Version=20131101&Cover=Big`;

                  const upstreamRes = await fetch(aladinSearchUrl, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (compatible; BookstoreInventoryApp/1.0)',
                      Accept: 'application/json, text/plain, */*',
                    },
                  });

                  if (upstreamRes.ok) {
                    const text = await upstreamRes.text();
                    const cleanJson = text.trim().replace(/;$/, '');
                    const aladinData = JSON.parse(cleanJson);

                    if (aladinData.item && Array.isArray(aladinData.item) && aladinData.item.length > 0) {
                      const books = aladinData.item.map((item: any) => {
                        let coverImg = item.cover || '';
                        if (coverImg.startsWith('http://')) {
                          coverImg = coverImg.replace('http://', 'https://');
                        }
                        const rawCategory = item.categoryName || '';
                        const category = rawCategory.includes('>')
                          ? rawCategory.split('>')[1] || rawCategory
                          : rawCategory || '소설/일반';

                        return {
                          isbn: item.isbn13 || item.isbn || '',
                          title: item.title || '',
                          author: item.author || '저자 미상',
                          publisher: item.publisher || '출판사 미상',
                          price: Number(item.priceStandard) || Number(item.priceSales) || 15000,
                          category,
                          coverImage: coverImg,
                          publishedDate: item.pubDate ? item.pubDate.replace(/-/g, '.') : '',
                          description: item.description || '',
                        };
                      });

                      res.statusCode = 200;
                      res.end(JSON.stringify({ success: true, books }));
                      return;
                    }
                  }
                } catch {
                  // Fallback to Google Books on Aladin error
                }
              }

              // Google Books search fallback
              try {
                const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
                  query
                )}&maxResults=8&hl=ko`;
                const gbRes = await fetch(gbUrl);
                if (gbRes.ok) {
                  const gbData = await gbRes.json();
                  if (Array.isArray(gbData.items) && gbData.items.length > 0) {
                    const books = gbData.items.map((item: any) => {
                      const vi = item.volumeInfo || {};
                      let coverImg =
                        vi.imageLinks?.thumbnail || vi.imageLinks?.smallThumbnail || '';
                      if (coverImg.startsWith('http://')) {
                        coverImg = coverImg.replace('http://', 'https://');
                      }
                      let isbnVal = '';
                      if (Array.isArray(vi.industryIdentifiers)) {
                        const isbn13 = vi.industryIdentifiers.find(
                          (id: any) => id.type === 'ISBN_13'
                        );
                        isbnVal = isbn13?.identifier || vi.industryIdentifiers[0]?.identifier || '';
                      }
                      return {
                        isbn: isbnVal,
                        title: vi.title || '',
                        author: Array.isArray(vi.authors) ? vi.authors.join(', ') : vi.authors || '저자 미상',
                        publisher: vi.publisher || '출판사 미상',
                        price: 15000,
                        category: Array.isArray(vi.categories) ? vi.categories[0] : '일반도서',
                        coverImage: coverImg,
                        publishedDate: vi.publishedDate ? vi.publishedDate.replace(/-/g, '.') : '',
                        description: vi.description || '',
                      };
                    });

                    res.statusCode = 200;
                    res.end(JSON.stringify({ success: true, books }));
                    return;
                  }
                }
              } catch {
                // Ignore Google Books fallback error
              }

              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, books: [] }));
              return;
            }

            // 2. ISBN Lookup mode (/api/aladin?isbn=...)
            if (!isbn || isbn.length !== 13) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, reason: 'INVALID_ISBN' }));
              return;
            }

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

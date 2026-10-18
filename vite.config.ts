import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';

function aladinProxyPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'aladin-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/aladin')) {
          try {
            const reqUrl = new URL(req.url, 'http://localhost:3000');
            const isbn = (reqUrl.searchParams.get('isbn') || '').replace(/[^0-9X]/gi, '').trim();
            const query = (reqUrl.searchParams.get('query') || reqUrl.searchParams.get('q') || '').trim();
            const ttbKey =
              env.ALADIN_TTB_KEY ||
              env.VITE_ALADIN_TTB_KEY ||
              process.env.ALADIN_TTB_KEY ||
              process.env.VITE_ALADIN_TTB_KEY ||
              '';

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

function nlBookProxyPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'nl-book-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/nl-book')) {
          try {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            const reqUrl = new URL(req.url, 'http://localhost:3000');
            const query = (reqUrl.searchParams.get('query') || reqUrl.searchParams.get('q') || reqUrl.searchParams.get('title') || '').trim();
            const isbn = (reqUrl.searchParams.get('isbn') || '').replace(/[^0-9X]/gi, '').trim();
            const certKey = env.NL_CERT_KEY || process.env.NL_CERT_KEY || '';

            if (!certKey) {
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: false,
                  reason: 'NL_CONFIG_ERROR',
                  message:
                    'NL_CERT_KEY is not configured in server environment. Please set NL_CERT_KEY in Cloudflare Pages Secrets or .env file.',
                })
              );
              return;
            }

            // 1. Keyword search mode (/api/nl-book?query=...)
            if (query && (!isbn || isbn.length !== 13)) {
              try {
                const nlTitleUrl = `https://www.nl.go.kr/seoji/SearchApi.do?cert_key=${encodeURIComponent(
                  certKey
                )}&result_style=json&page_no=1&page_size=15&title=${encodeURIComponent(query)}`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);

                const upstreamRes = await fetch(nlTitleUrl, {
                  signal: controller.signal,
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; DokjaBookstore/1.0)',
                    Accept: 'application/json, text/plain, */*',
                  },
                });
                clearTimeout(timeoutId);

                let docs: any[] = [];
                if (upstreamRes.ok) {
                  const text = await upstreamRes.text();
                  try {
                    const data = JSON.parse(text.trim());
                    if (Array.isArray(data.docs)) docs = data.docs;
                    else if (Array.isArray(data.item)) docs = data.item;
                    else if (data.docs) docs = [data.docs];
                  } catch {}
                }

                // If fewer than 5 results by title, also query by author
                if (docs.length < 5) {
                  try {
                    const nlAuthorUrl = `https://www.nl.go.kr/seoji/SearchApi.do?cert_key=${encodeURIComponent(
                      certKey
                    )}&result_style=json&page_no=1&page_size=10&author=${encodeURIComponent(query)}`;
                    const aController = new AbortController();
                    const aTimeout = setTimeout(() => aController.abort(), 6000);
                    const aRes = await fetch(nlAuthorUrl, {
                      signal: aController.signal,
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; DokjaBookstore/1.0)',
                        Accept: 'application/json, text/plain, */*',
                      },
                    });
                    clearTimeout(aTimeout);
                    if (aRes.ok) {
                      const aText = await aRes.text();
                      const aData = JSON.parse(aText.trim());
                      const aDocs = Array.isArray(aData.docs) ? aData.docs : Array.isArray(aData.item) ? aData.item : [];
                      for (const ad of aDocs) {
                        const adIsbn = ad.EA_ISBN || '';
                        if (!docs.some((d: any) => (d.EA_ISBN || '') === adIsbn && adIsbn !== '')) {
                          docs.push(ad);
                        }
                      }
                    }
                  } catch {}
                }

                const seenIsbns = new Set<string>();
                const books = docs
                  .filter((d: any) => Boolean(d.TITLE))
                  .map((item: any) => {
                    const eaIsbn = (item.EA_ISBN || '').replace(/[^0-9X]/gi, '').trim();
                    const rawTitle = (item.TITLE || '').trim();
                    const cleanTitle = rawTitle.replace(/^(전자책_|종이책_|\[도서\]\s*)/, '');
                    const rawAuthor = (item.AUTHOR || '').trim();
                    const cleanAuthor = rawAuthor.replace(/^(저자\s*:\s*|지은이\s*:\s*)/, '').trim() || '저자 미상';
                    const publisher = (item.PUBLISHER || '').trim() || '출판사 미상';
                    const priceStr = item.REAL_PRICE || item.PRE_PRICE || '';
                    const price = Number(String(priceStr).replace(/[^0-9]/g, '')) || 15000;
                    let pubDate = (item.PUBLISH_PREDATE || item.REAL_PUBLISH_DATE || '').trim();
                    if (/^\d{8}$/.test(pubDate)) {
                      pubDate = `${pubDate.slice(0, 4)}.${pubDate.slice(4, 6)}.${pubDate.slice(6, 8)}`;
                    }

                    return {
                      isbn: eaIsbn,
                      title: cleanTitle,
                      author: cleanAuthor,
                      publisher,
                      price,
                      category: '국내도서',
                      publishedDate: pubDate,
                      coverImage: '',
                      description: item.BOOK_INTRODUCTION || item.BOOK_SUMMARY || '',
                    };
                  })
                  .filter((b: any) => {
                    if (!b.isbn) return true;
                    if (seenIsbns.has(b.isbn)) return false;
                    seenIsbns.add(b.isbn);
                    return true;
                  });

                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, books }));
                return;
              } catch (err: any) {
                res.statusCode = 200;
                res.end(JSON.stringify({ success: false, reason: 'NL_KEYWORD_ERROR', message: err?.message }));
                return;
              }
            }

            if (!isbn || isbn.length !== 13) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  success: false,
                  reason: 'INVALID_ISBN',
                  message: 'A valid 13-digit ISBN is required.',
                })
              );
              return;
            }

            const nlUrl = `https://www.nl.go.kr/seoji/SearchApi.do?cert_key=${encodeURIComponent(
              certKey
            )}&result_style=json&page_no=1&page_size=10&isbn=${encodeURIComponent(isbn)}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const upstreamRes = await fetch(nlUrl, {
              signal: controller.signal,
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; DokjaBookstore/1.0)',
                Accept: 'application/json, text/plain, */*',
              },
            });
            clearTimeout(timeoutId);

            if (!upstreamRes.ok) {
              res.statusCode = 502;
              res.end(
                JSON.stringify({
                  success: false,
                  reason: 'NL_API_ERROR',
                  message: `National Library upstream HTTP ${upstreamRes.status}`,
                })
              );
              return;
            }

            const text = await upstreamRes.text();
            let data: any;
            try {
              data = JSON.parse(text.trim());
            } catch {
              res.statusCode = 502;
              res.end(
                JSON.stringify({
                  success: false,
                  reason: 'NL_API_ERROR',
                  message: 'Invalid JSON response from National Library API.',
                })
              );
              return;
            }

            if (data.RESULT === 'ERROR' || data.ERR_CODE) {
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: false,
                  reason: 'NL_API_ERROR',
                  errorCode: data.ERR_CODE,
                  message: data.ERR_MESSAGE || 'National Library API error',
                })
              );
              return;
            }

            const rawDocs = Array.isArray(data.docs)
              ? data.docs
              : Array.isArray(data.item)
              ? data.item
              : data.docs
              ? [data.docs]
              : [];

            if (rawDocs.length === 0) {
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: false,
                  reason: 'NOT_FOUND',
                  message: 'No book matches the given ISBN in National Library database.',
                })
              );
              return;
            }

            const item =
              rawDocs.find((d: any) => d.EA_ISBN && d.EA_ISBN.replace(/[^0-9X]/gi, '') === isbn) ||
              rawDocs[0];

            const eaIsbn = item.EA_ISBN || isbn;
            const title = (item.TITLE || '').trim();
            const author = (item.AUTHOR || '').trim() || '저자 미상';
            const publisher = (item.PUBLISHER || '').trim() || '출판사 미상';
            const publishPredate = (item.PUBLISH_PREDATE || '').trim();
            const prePrice =
              item.PRE_PRICE !== undefined && item.PRE_PRICE !== null
                ? String(item.PRE_PRICE).trim()
                : '';
            const kdc = (item.KDC || '').trim();
            const kdcClassNo = (item.KDC_CLASS_NO || '').trim();
            const eaAddCode = (item.EA_ADD_CODE || '').trim();

            let formattedDate = publishPredate;
            if (/^\d{8}$/.test(publishPredate)) {
              formattedDate = `${publishPredate.slice(0, 4)}.${publishPredate.slice(4, 6)}.${publishPredate.slice(6, 8)}`;
            } else if (publishPredate.includes('-')) {
              formattedDate = publishPredate.replace(/-/g, '.');
            }

            const numericPrice = Number(prePrice.replace(/[^0-9]/g, '')) || 0;

            res.statusCode = 200;
            res.end(
              JSON.stringify({
                success: true,
                source: 'NATIONAL_LIBRARY_OF_KOREA',
                totalCount: data.TOTAL_COUNT || rawDocs.length,
                fields: {
                  EA_ISBN: eaIsbn,
                  TITLE: title,
                  AUTHOR: author,
                  PUBLISHER: publisher,
                  PUBLISH_PREDATE: publishPredate,
                  PRE_PRICE: prePrice,
                  KDC: kdc,
                  KDC_CLASS_NO: kdcClassNo,
                  EA_ADD_CODE: eaAddCode,
                },
                book: {
                  isbn: eaIsbn,
                  title,
                  author,
                  publisher,
                  price: numericPrice,
                  publishedDate: formattedDate,
                  kdc,
                  kdcClassNo,
                  addCode: eaAddCode,
                  coverImage: '',
                  description: item.BOOK_INTRODUCTION || item.DESCRIPTION || '',
                },
              })
            );
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                success: false,
                reason: 'NL_API_ERROR',
                message: err?.message || 'Internal proxy error',
              })
            );
          }
        } else {
          next();
        }
      });
    },
  };
}

function naverBookProxyPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'naver-book-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/naver-book')) {
          try {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            const reqUrl = new URL(req.url, 'http://localhost:3000');
            const query = (reqUrl.searchParams.get('query') || reqUrl.searchParams.get('q') || '').trim();
            const isbn = (reqUrl.searchParams.get('isbn') || '').replace(/[^0-9X]/gi, '').trim();

            const clientId =
              env.NAVER_CLIENT_ID ||
              env.VITE_NAVER_CLIENT_ID ||
              process.env.NAVER_CLIENT_ID ||
              process.env.VITE_NAVER_CLIENT_ID ||
              '';
            const clientSecret =
              env.NAVER_CLIENT_SECRET ||
              env.VITE_NAVER_CLIENT_SECRET ||
              process.env.NAVER_CLIENT_SECRET ||
              process.env.VITE_NAVER_CLIENT_SECRET ||
              '';

            if (!clientId || !clientSecret) {
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: false,
                  reason: 'NAVER_CONFIG_ERROR',
                  message: 'NAVER_CLIENT_ID or NAVER_CLIENT_SECRET is not configured.',
                })
              );
              return;
            }

            const targetQuery = isbn || query;
            if (!targetQuery) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  success: false,
                  reason: 'EMPTY_QUERY',
                  message: 'Search query or ISBN is required.',
                })
              );
              return;
            }

            const naverUrl = `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(
              targetQuery
            )}&display=10&start=1&sort=sim`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);

            const upstreamRes = await fetch(naverUrl, {
              signal: controller.signal,
              headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret,
                Accept: 'application/json',
              },
            });
            clearTimeout(timeoutId);

            if (!upstreamRes.ok) {
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  success: false,
                  reason: 'NAVER_API_ERROR',
                  status: upstreamRes.status,
                  message: `Naver upstream HTTP ${upstreamRes.status}`,
                })
              );
              return;
            }

            const data: any = await upstreamRes.json();
            const items = Array.isArray(data.items) ? data.items : [];

            const cleanText = (str: string) =>
              (str || '')
                .replace(/<[^>]+>/g, '')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&#39;/g, "'")
                .trim();

            const books = items.map((item: any) => {
              const isbnParts = (item.isbn || '').split(' ');
              const resolvedIsbn = isbnParts.find((p: string) => p.length === 13) || isbnParts[0] || '';

              let pubDate = item.pubdate || '';
              if (/^\d{8}$/.test(pubDate)) {
                pubDate = `${pubDate.slice(0, 4)}.${pubDate.slice(4, 6)}.${pubDate.slice(6, 8)}`;
              }

              let coverImg = item.image || '';
              if (coverImg.startsWith('http://')) {
                coverImg = coverImg.replace('http://', 'https://');
              }

              return {
                isbn: resolvedIsbn,
                title: cleanText(item.title),
                author: cleanText(item.author) || '저자 미상',
                publisher: cleanText(item.publisher) || '출판사 미상',
                price: Number(item.discount) || 15000,
                category: '국내도서',
                coverImage: coverImg,
                publishedDate: pubDate,
                description: cleanText(item.description),
              };
            });

            if (isbn && books.length > 0) {
              const exactBook = books.find((b: any) => b.isbn === isbn) || books[0];
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, book: exactBook, books }));
              return;
            }

            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, books }));
          } catch (err: any) {
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                success: false,
                reason: 'NAVER_PROXY_ERROR',
                message: err?.message || 'Internal proxy error',
              })
            );
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      aladinProxyPlugin(env),
      nlBookProxyPlugin(env),
      naverBookProxyPlugin(env),
    ],
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

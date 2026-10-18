// Cloudflare Pages Function: /api/nl-book
// Handles server-side National Library of Korea (국립중앙도서관) ISBN Bibliographic & Search API requests securely
// Endpoint: https://www.nl.go.kr/seoji/SearchApi.do

interface NLEnv {
  NL_CERT_KEY?: string;
  [key: string]: any;
}

export const onRequestGet = async (context: { request: Request; env: NLEnv }): Promise<Response> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };

  try {
    const url = new URL(context.request.url);
    const query = (url.searchParams.get('query') || url.searchParams.get('q') || url.searchParams.get('title') || '').trim();
    const rawIsbn = url.searchParams.get('isbn') || '';
    const cleanIsbn = rawIsbn.replace(/[^0-9X]/gi, '').trim();

    // 1. Retrieve NL_CERT_KEY from server environment (never exposed to client)
    const certKey =
      context.env?.NL_CERT_KEY ||
      (typeof process !== 'undefined' ? process.env?.NL_CERT_KEY : '');

    if (!certKey) {
      console.warn('[NL Book Proxy] NL_CERT_KEY secret is not configured in server environment');
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'NL_CONFIG_ERROR',
          message: 'NL_CERT_KEY is not configured in server environment. Please register NL_CERT_KEY in Cloudflare Pages Secrets or .env file.',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 2. Keyword Search Mode (/api/nl-book?query=...)
    if (query && (!cleanIsbn || cleanIsbn.length !== 13)) {
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

        return new Response(JSON.stringify({ success: true, books }), {
          status: 200,
          headers: corsHeaders,
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, reason: 'NL_KEYWORD_ERROR', message: err?.message }),
          { status: 200, headers: corsHeaders }
        );
      }
    }

    // 3. ISBN Validation: Ensure valid 13-digit format
    if (!cleanIsbn || cleanIsbn.length !== 13) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'INVALID_ISBN',
          message: 'A valid 13-digit ISBN or query keyword is required.',
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 4. Construct National Library Seoji SearchApi.do URL by ISBN
    const nlUrl = `https://www.nl.go.kr/seoji/SearchApi.do?cert_key=${encodeURIComponent(
      certKey
    )}&result_style=json&page_no=1&page_size=10&isbn=${encodeURIComponent(cleanIsbn)}`;

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
      console.warn(`[NL Book Proxy] Upstream HTTP error: ${upstreamRes.status}`);
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'NL_API_ERROR',
          message: `National Library upstream HTTP ${upstreamRes.status}`,
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    const text = await upstreamRes.text();
    let data: any;
    try {
      data = JSON.parse(text.trim());
    } catch {
      console.warn('[NL Book Proxy] Failed to parse National Library response JSON');
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'NL_API_ERROR',
          message: 'Invalid JSON response from National Library API.',
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    // 5. Check API-level error (e.g. invalid cert_key or quota)
    if (data.RESULT === 'ERROR' || data.ERR_CODE) {
      console.warn(`[NL Book Proxy] API Error [${data.ERR_CODE}]: ${data.ERR_MESSAGE}`);
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'NL_API_ERROR',
          errorCode: data.ERR_CODE,
          message: data.ERR_MESSAGE || 'National Library API error',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 6. Extract item list from docs
    const rawDocs = Array.isArray(data.docs)
      ? data.docs
      : Array.isArray(data.item)
      ? data.item
      : data.docs
      ? [data.docs]
      : [];

    if (rawDocs.length === 0) {
      console.log(`[NL Book Proxy] ISBN: ${cleanIsbn} | Result: not found`);
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'NOT_FOUND',
          message: 'No book matches the given ISBN in National Library database.',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Match exact EA_ISBN or take the first document
    const item =
      rawDocs.find((d: any) => d.EA_ISBN && d.EA_ISBN.replace(/[^0-9X]/gi, '') === cleanIsbn) ||
      rawDocs[0];

    const eaIsbn = item.EA_ISBN || cleanIsbn;
    const title = (item.TITLE || '').trim();
    const author = (item.AUTHOR || '').replace(/^(저자\s*:\s*|지은이\s*:\s*)/, '').trim() || '저자 미상';
    const publisher = (item.PUBLISHER || '').trim() || '출판사 미상';
    const publishPredate = (item.PUBLISH_PREDATE || '').trim();
    const prePrice = item.PRE_PRICE !== undefined && item.PRE_PRICE !== null ? String(item.PRE_PRICE).trim() : '';
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

    console.log(`[NL Book Proxy] ISBN: ${cleanIsbn} | Result: found | Title: ${title}`);

    return new Response(
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
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('[NL Book Proxy] Unhandled exception:', err?.message || err);
    return new Response(
      JSON.stringify({
        success: false,
        reason: 'NL_API_ERROR',
        message: err?.message || 'Internal proxy error',
      }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const onRequestOptions = async (): Promise<Response> => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};

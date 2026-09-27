// Cloudflare Pages Function: /api/nl-book
// Handles server-side National Library of Korea (국립중앙도서관) ISBN Bibliographic Information API requests securely
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
    const rawIsbn = url.searchParams.get('isbn') || '';
    const cleanIsbn = rawIsbn.replace(/[^0-9X]/gi, '').trim();

    // 1. ISBN-13 validation
    if (!cleanIsbn || cleanIsbn.length !== 13) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'INVALID_ISBN',
          message: 'A valid 13-digit ISBN is required.',
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Retrieve NL_CERT_KEY from server environment (never exposed to client)
    const certKey =
      context.env?.NL_CERT_KEY ||
      (typeof process !== 'undefined' ? process.env?.NL_CERT_KEY : '');

    if (!certKey) {
      console.warn('[NL Book Proxy] NL_CERT_KEY secret is not configured in server environment');
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'NL_CONFIG_ERROR',
          message: 'NL_CERT_KEY is not configured in server environment. Please register NL_CERT_KEY in Cloudflare Pages Secrets.',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 3. Construct National Library Seoji SearchApi.do URL
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

    // 4. Check API-level error (e.g. invalid cert_key or quota)
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

    // 5. Extract item list from docs
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

    // Extract exact response fields specified by National Library OpenAPI:
    // EA_ISBN, TITLE, AUTHOR, PUBLISHER, PUBLISH_PREDATE, PRE_PRICE, KDC, KDC_CLASS_NO, EA_ADD_CODE
    const eaIsbn = item.EA_ISBN || cleanIsbn;
    const title = (item.TITLE || '').trim();
    const author = (item.AUTHOR || '').trim() || '저자 미상';
    const publisher = (item.PUBLISHER || '').trim() || '출판사 미상';
    const publishPredate = (item.PUBLISH_PREDATE || '').trim();
    const prePrice = item.PRE_PRICE !== undefined && item.PRE_PRICE !== null ? String(item.PRE_PRICE).trim() : '';
    const kdc = (item.KDC || '').trim();
    const kdcClassNo = (item.KDC_CLASS_NO || '').trim();
    const eaAddCode = (item.EA_ADD_CODE || '').trim();

    // Format publication date (e.g. YYYYMMDD -> YYYY.MM.DD)
    let formattedDate = publishPredate;
    if (/^\d{8}$/.test(publishPredate)) {
      formattedDate = `${publishPredate.slice(0, 4)}.${publishPredate.slice(4, 6)}.${publishPredate.slice(6, 8)}`;
    } else if (publishPredate.includes('-')) {
      formattedDate = publishPredate.replace(/-/g, '.');
    }

    // Clean numeric price
    const numericPrice = Number(prePrice.replace(/[^0-9]/g, '')) || 0;

    console.log(`[NL Book Proxy] ISBN: ${cleanIsbn} | Result: found | Title: ${title}`);

    return new Response(
      JSON.stringify({
        success: true,
        source: 'NATIONAL_LIBRARY_OF_KOREA',
        totalCount: data.TOTAL_COUNT || rawDocs.length,
        // Raw verified fields
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
        // Normalized Book format for Dokja Bookstore store integration
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
          // Cover and full description are not provided directly by SearchApi.do
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

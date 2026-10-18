// Cloudflare Pages Function: /api/naver-book
// Handles server-side Naver Book Search API requests securely without exposing Client Secret to browser
// Endpoint: https://openapi.naver.com/v1/search/book.json

interface NaverEnv {
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;
  [key: string]: any;
}

export const onRequestGet = async (context: { request: Request; env: NaverEnv }): Promise<Response> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };

  try {
    const url = new URL(context.request.url);
    const query = (url.searchParams.get('query') || url.searchParams.get('q') || '').trim();
    const rawIsbn = url.searchParams.get('isbn') || '';
    const cleanIsbn = rawIsbn.replace(/[^0-9X]/gi, '').trim();

    const clientId =
      context.env?.NAVER_CLIENT_ID ||
      (typeof process !== 'undefined' ? process.env?.NAVER_CLIENT_ID : '');
    const clientSecret =
      context.env?.NAVER_CLIENT_SECRET ||
      (typeof process !== 'undefined' ? process.env?.NAVER_CLIENT_SECRET : '');

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'NAVER_CONFIG_ERROR',
          message: 'NAVER_CLIENT_ID or NAVER_CLIENT_SECRET is not configured in server environment.',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const targetQuery = cleanIsbn || query;
    if (!targetQuery) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'EMPTY_QUERY',
          message: 'Search query or ISBN is required.',
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const naverUrl = `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(
      targetQuery
    )}&display=10&start=1&sort=sim`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const naverRes = await fetch(naverUrl, {
      signal: controller.signal,
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
        Accept: 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (!naverRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'NAVER_API_ERROR',
          status: naverRes.status,
          message: `Naver upstream HTTP ${naverRes.status}`,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    const data: any = await naverRes.json();
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

    if (cleanIsbn && books.length > 0) {
      const exactBook = books.find((b: any) => b.isbn === cleanIsbn) || books[0];
      return new Response(
        JSON.stringify({ success: true, book: exactBook, books }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true, books }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        reason: 'NAVER_PROXY_ERROR',
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

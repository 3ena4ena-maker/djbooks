// Cloudflare Pages Function: /api/aladin
// Handles server-side Aladin Open API ItemLookUp requests securely without exposing TTB Key to browser

interface AladinEnv {
  ALADIN_TTB_KEY?: string;
  [key: string]: any;
}

export const onRequestGet = async (context: { request: Request; env: AladinEnv }): Promise<Response> => {
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

    // 1. ISBN Validation: Ensure valid 13-digit format
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

    // 2. Secret Key Retrieval
    const ttbKey =
      context.env?.ALADIN_TTB_KEY ||
      context.env?.VITE_ALADIN_TTB_KEY ||
      (typeof process !== 'undefined' ? process.env?.ALADIN_TTB_KEY || process.env?.VITE_ALADIN_TTB_KEY : '');

    if (!ttbKey) {
      console.error('[Aladin Proxy] ALADIN_TTB_KEY secret is not configured in Cloudflare Pages environment');
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'ALADIN_CONFIG_ERROR',
          message: 'ALADIN_TTB_KEY is not configured in server environment.',
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 3. Construct Aladin ItemLookUp URL (Version 20131101, ISBN-13, Big Cover)
    const aladinUrl = `https://www.aladin.co.kr/ttb/api/ItemLookUp.aspx?ttbkey=${encodeURIComponent(
      ttbKey
    )}&itemIdType=ISBN13&ItemId=${encodeURIComponent(
      cleanIsbn
    )}&output=js&Version=20131101&Cover=Big`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const aladinRes = await fetch(aladinUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BookstoreInventoryApp/1.0)',
        Accept: 'application/json, text/plain, */*',
      },
    });
    clearTimeout(timeoutId);

    if (!aladinRes.ok) {
      console.warn(`[Aladin Proxy] Aladin HTTP Error: ${aladinRes.status}`);
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'ALADIN_API_ERROR',
          message: `Aladin upstream HTTP ${aladinRes.status}`,
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    const text = await aladinRes.text();
    const cleanJson = text.trim().replace(/;$/, '');
    let aladinData: any;
    try {
      aladinData = JSON.parse(cleanJson);
    } catch {
      console.warn('[Aladin Proxy] Failed to parse Aladin response JSON');
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'ALADIN_API_ERROR',
          message: 'Invalid JSON response from Aladin API.',
        }),
        { status: 502, headers: corsHeaders }
      );
    }

    // 4. Handle Aladin API error codes
    if (aladinData.errorCode || aladinData.errorMessage) {
      console.warn(`[Aladin Proxy] Aladin API Code ${aladinData.errorCode}: ${aladinData.errorMessage}`);
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'ALADIN_API_ERROR',
          message: aladinData.errorMessage || 'Aladin API error',
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 5. Parse Item Array
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

      console.log(`[Aladin Proxy] ISBN: ${cleanIsbn} | HTTP Status: 200 | Result: found`);

      return new Response(
        JSON.stringify({
          success: true,
          book: {
            isbn: item.isbn13 || cleanIsbn,
            title,
            author,
            publisher,
            publishedDate: pubDate,
            price,
            category,
            coverImage: coverImg,
            description: item.description || '',
          },
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Not found
    console.log(`[Aladin Proxy] ISBN: ${cleanIsbn} | HTTP Status: 200 | Result: not found`);
    return new Response(
      JSON.stringify({
        success: false,
        reason: 'NOT_FOUND',
        message: 'No book matches the given ISBN in Aladin database.',
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('[Aladin Proxy] Unhandled exception:', err?.message || err);
    return new Response(
      JSON.stringify({
        success: false,
        reason: 'ALADIN_API_ERROR',
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

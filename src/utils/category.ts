/**
 * 도서 카테고리 3단계 계층 구조 파싱 및 화면 표시용 유틸리티
 */

export interface ParsedCategory {
  main: string;
  middle: string;
  sub: string;
  display: string;
  full: string;
}

/**
 * 카테고리 문자열 또는 3단계 구조에서 계층을 분해하고,
 * 화면에 표시할 가장 구체적인 최종 소분류(마지막 단계)를 추출합니다.
 *
 * 규칙:
 * - 전체 경로가 '국내도서 > 소설 > 한국소설'이면 -> 최종 소분류 '한국소설'
 * - '국내도서 > 소설 > 추리/미스터리' -> '추리/미스터리'
 * - '국내도서 > 소설 > 판타지' -> '판타지'
 * - '국내도서 > 에세이 > 한국에세이' -> '한국에세이'
 * - '국내도서 > 인문 > 철학' -> '철학'
 * - '국내도서 > 경제/경영 > 재테크' -> '재테크'
 * - 소분류가 없는 경우(예: '국내도서 > 인문') -> 가장 구체적인 카테고리 '인문'
 * - 카테고리 정보가 전혀 없거나 빈 문자열인 경우 -> '미분류'
 * - 단일 카테고리(예: '한국소설', '철학') -> 그대로 반환
 */
export function parseCategoryHierarchy(category?: string | null): ParsedCategory {
  if (!category || !category.trim()) {
    return {
      main: '',
      middle: '',
      sub: '',
      display: '미분류',
      full: '',
    };
  }

  const clean = category.trim();

  // '>' 구분자가 포함된 계층형 카테고리
  if (clean.includes('>')) {
    const segments = clean
      .split('>')
      .map((s) => s.trim())
      .filter(Boolean);

    if (segments.length === 0) {
      return {
        main: '',
        middle: '',
        sub: '',
        display: '미분류',
        full: clean,
      };
    }

    const main = segments[0] || '';
    const middle = segments.length >= 2 ? segments[1] : '';
    // 가장 마지막 단계가 최종 소분류
    const sub = segments[segments.length - 1] || '';

    // 화면 표시명: 가장 마지막 단계 (소분류 -> 중분류 -> 대분류 순으로 구체적인 값 선택)
    const display = sub || middle || main || '미분류';

    return {
      main,
      middle,
      sub,
      display,
      full: clean,
    };
  }

  // '>'가 없는 단일 문자열 (예: 사용자가 직접 입력한 카테고리명)
  return {
    main: '',
    middle: '',
    sub: clean,
    display: clean,
    full: clean,
  };
}

/**
 * 도서 객체 또는 카테고리 문자열로부터 화면에 표시할 최종 소분류명만 반환합니다.
 * 절대로 '국내도서 > 소설 > 한국소설' 처럼 전체 경로를 표시하지 않습니다.
 */
export function getDisplayCategory(
  bookOrCategory?:
    | {
        category?: string | null;
        categorySub?: string | null;
        categoryMiddle?: string | null;
        categoryMain?: string | null;
      }
    | string
    | null
): string {
  if (!bookOrCategory) return '미분류';

  // 1. 단순 문자열인 경우
  if (typeof bookOrCategory === 'string') {
    return parseCategoryHierarchy(bookOrCategory).display;
  }

  // 2. Book 객체인 경우
  // 2-1. categorySub 필드가 명시되어 있으면 우선 확인
  if (bookOrCategory.categorySub && bookOrCategory.categorySub.trim()) {
    return parseCategoryHierarchy(bookOrCategory.categorySub).display;
  }

  // 2-2. category 필드 확인 (전체 경로 '국내도서 > 소설 > 한국소설' 등)
  if (bookOrCategory.category && bookOrCategory.category.trim()) {
    return parseCategoryHierarchy(bookOrCategory.category).display;
  }

  // 2-3. categoryMiddle 필드 확인
  if (bookOrCategory.categoryMiddle && bookOrCategory.categoryMiddle.trim()) {
    return parseCategoryHierarchy(bookOrCategory.categoryMiddle).display;
  }

  // 2-4. categoryMain 필드 확인
  if (bookOrCategory.categoryMain && bookOrCategory.categoryMain.trim()) {
    return parseCategoryHierarchy(bookOrCategory.categoryMain).display;
  }

  return '미분류';
}

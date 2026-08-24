import { Book, Inventory, InventoryLog } from '../types';

export const INITIAL_BOOKS: Book[] = [
  {
    id: 'book-1',
    isbn: '9780525559474',
    title: '미드나잇 라이브러리',
    author: '매트 헤이그',
    publisher: '인플루엔셜',
    price: 15800,
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB1s8gZ7LTAqT1YLl2uj_4pVLufWiFyJiNNAQkPtjL1_NR4rLlBY5Hb2kHIaE7ERh2JZNa72Wu68zVfqsR2TSPoo4axVgTCNb98XXngBDE39Gmb5fiNGE5kb0THRpBKaCJpNvvalY7cNQr-5LZzw_BkxhupmRtLSvQYZkU36y5ltHVtJ96KkF_rnuYRTR9VlolI50U5PIdnqyFa5qOJU55pvQLWYWgDt6HFLf6zFiGhKFtAXyTrGYBi',
    category: '소설',
    publishedDate: '2021년 4월 28일',
    bindingType: '양장본',
    location: 'A4 선반, 소설 구역',
    description: '삶의 무수한 갈림길에서 선택하지 못한 다른 삶들을 경험해보는 마법 같은 자정의 도서관 이야기.',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-24T10:15:00.000Z'
  },
  {
    id: 'book-2',
    isbn: '9788956608877',
    title: '오버스토리',
    author: '리처드 파워스',
    publisher: '은행나무',
    price: 18000,
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB7BXe3FWVnH2oYYv2TLEo0WKB6LnMzLWj_qqdw10gTXgtZ6vlo9b8Nzm-U1ExmE9KK7AYtQM1K8IzGwjVqiQ4B_jF4G-18sTzQNiUPZNh1XI6b7pFoB1dRcFex_PhnKXWrDaFQ2jK-TUOlHR630f-JhgLys86u1FW57zFiUtY8_SnatZXBPftqbjcIKVJLNHYQVHGtzOW5xAJnKuaNbYWoNi1Rat_2nsMwy5izTCMspWJF59ws-Y8h',
    category: '소설',
    publishedDate: '2019년 10월 15일',
    bindingType: '무선제본',
    location: 'A2 선반, 외국소설',
    description: '퓰리처상 수상작. 나무와 인간의 거대한 교감과 운명을 다룬 웅장한 생태 문학의 정수.',
    createdAt: '2026-08-05T11:00:00.000Z',
    updatedAt: '2026-08-24T09:30:00.000Z'
  },
  {
    id: 'book-3',
    isbn: '9788954655972',
    title: '여행의 이유',
    author: '김영하',
    publisher: '복복서가',
    price: 13500,
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD0f346Bpwm36CcChN9zhJvqh8MeSUzd_aafN7gfQiSxjzmyLEOg8j4IzhhEawXwHIXOXXRjfGGhwlDkXIpmIQfzRluYUUK0sbJekM035Nxuxe2Y-0maqexYxOitEFuGMGZn1ogTPHZG5vd9z-ji2u08Irkos7XZAJ-rdl7FGqz8JOgA0Zlwr3-xCChB2LnBga10sTfu6q2egYc6ja6GSwVLCF3MK7eo_YVUeSEDQIxhtSgaNu5V54p',
    category: '에세이',
    publishedDate: '2019년 4월 17일',
    bindingType: '무선제본',
    location: 'C3 선반, 에세이',
    description: '인간은 왜 여행을 떠나는가. 여행의 시작과 끝, 방랑과 귀환에 관한 깊은 사유.',
    createdAt: '2026-08-02T10:00:00.000Z',
    updatedAt: '2026-08-24T08:00:00.000Z'
  },
  {
    id: 'book-4',
    isbn: '9791186712399',
    title: '아무튼, 산책',
    author: '한수희',
    publisher: '위고',
    price: 9900,
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAOw8RLdjGuU-WTUm425uMuXgmoZPuRSy5cvxOj09moq7gKTbdUDNg3e2GMA72-sL2AcvMYyhFR6MPivLgIf4KOOgUPW2T4M1w_yV9G9PSxTbFNUdMr-0-qfPaRxAPF4vaSVxUaqWU5idzAkSdJXPuhu6jUa-fltScFLKzTX_NntkuXQlLf-sAH0bOx4wNzgTYnFZLlpT7AJ98eRxGecCPnlyoisSeZD34QMGBs9q2rI4XEMsWdQM-H',
    category: '에세이',
    publishedDate: '2020년 7월 20일',
    bindingType: '무선제본',
    location: 'C1 선반, 아무튼 시리즈',
    description: '걸음마다 피어나는 일상의 잔잔한 행복과 위로를 담은 산책 이야기.',
    createdAt: '2026-08-10T14:20:00.000Z',
    updatedAt: '2026-08-24T11:00:00.000Z'
  },
  {
    id: 'book-5',
    isbn: '9791188810666',
    title: '구의 증명',
    author: '최진영',
    publisher: '은행나무',
    price: 12000,
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuASEUv4PSfPgt_aSSSa7PhKtPqj07bqNNF3A023o6FjbKnEaifpg0AVpEjl2P1w4M95RRrOamInwvkVR5rX7hftSX1GHilqegHcJfZrNk9pkhUw0U0nw7ajxy2neyByWd72BqfyjbGu1sM-2dCHG631QgHSHa9yC5CnNy2yXWJKiTF2NjPDEiJar1IYWV3kh0eamf6GEs136RNRhEcjmHY85-JBoHcgb5HBNwcn5Qo0dWdPt1O7WVTg',
    category: '소설',
    publishedDate: '2015년 3월 30일',
    bindingType: '무선제본',
    location: 'A3 선반, 한국소설',
    description: '사랑하는 연인을 애도하는 가장 파격적이고도 순수한 사랑의 이야기.',
    createdAt: '2026-08-08T16:00:00.000Z',
    updatedAt: '2026-08-24T12:00:00.000Z'
  },
  {
    id: 'book-6',
    isbn: '9788936434120',
    title: '소년이 온다',
    author: '한강',
    publisher: '창비',
    price: 15000,
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCwwiJze1RzmICdx-xAGJbQYGIwF1jfMZLr0dgQwZSjSYL8NurQxqYZOSfg1iay7FcAxowhd0aHIMviy06RKY99FphDxYI9Jaqnr3KYwrkmPsNWy2dhVBY6XN9hZpub7DHmSxATD4tmEv_Q8PzKhI2lNiop0l3x3oZRkIxYBrbdcNqLymjhrFB4Q08Y5Wh2DITtGJMh3RuIwk_9BaZzST7OaWL-s67N8KYca6BgTevReFO1GinIZ9kx',
    category: '소설',
    publishedDate: '2014년 5월 19일',
    bindingType: '양장본',
    location: 'B1 선반, 한국문학',
    description: '노벨문학상 수상 작가 한강의 대표작. 1980년 5월 광주의 숨결을 온몸으로 기억하는 서사.',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-24T15:20:00.000Z'
  },
  {
    id: 'book-7',
    isbn: '9791196482103',
    title: '작은 가게의 기록',
    author: '독립출판',
    publisher: '자가출판',
    price: 12000,
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCPT-mZEGBqkwuuAZmjseenDIaurCGc0nU1Bz0FuU2wRm-zvxT2P93WkZUzKVKG29W3Yzkf2GRMKfWgtndL-ipDHjxQgvo2TO4DvJT3lSgz63aIRIM5KLA7zDpcnhBPxzgmBlxRXJTnAQrdnTVxrIWwccm3NWin8hj0zzroVD7urtImNRHU9J7cU5BKiDaey-S-hG6dZInGzj5vvvEgPMPKEabje7fH82VXcKpNHT2LxqCRrk-SHGcj',
    category: '독립출판',
    publishedDate: '2022년 11월 10일',
    bindingType: '중철제본',
    location: 'D1 선반, 독립출판 매대',
    description: '골목 안 작은 동네 책방을 열고 지켜온 소박하고 다정한 시간들의 기록.',
    createdAt: '2026-08-12T13:00:00.000Z',
    updatedAt: '2026-08-24T07:45:00.000Z'
  },
  {
    id: 'book-8',
    isbn: '9788954699075',
    title: '도시와 그 불확실한 벽',
    author: '무라카미 하루키',
    publisher: '문학동네',
    price: 19500,
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA7MxAeXp7bXdYcpkHZqqqfdZoxi9EWPkZzViuaBwM4GRmFL0E90-ppnjy-ikBhbAguLgm3AgRq0xalrCfoa4N9LL107u4JBNVd64KbNi6r4ELWpfJkbvTDfiM1kylmV7sHM7XOd80mWDc2ObCgujuLYAVlnlz3E6wy9AQT539cHTZuVPOBC1Af0eIsZhxrdebQT4Sdd5GpJvxkEd_iFKgiAsfjgiRDQ9l1fH5CoMvxY9SrMLMPSqy1',
    category: '소설',
    publishedDate: '2023년 9월 6일',
    bindingType: '양장본',
    location: 'A1 선반, 외국소설',
    description: '높은 벽에 둘러싸인 신비로운 도시와 현실 세계 사이를 오가는 환상적인 여정.',
    createdAt: '2026-08-04T10:00:00.000Z',
    updatedAt: '2026-08-23T16:30:00.000Z'
  },
  {
    id: 'book-9',
    isbn: '9788954609203',
    title: '문학동네 세계문학전집 001: 위대한 개츠비',
    author: 'F. 스콧 피츠제럴드',
    publisher: '문학동네',
    price: 11000,
    coverImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB1s8gZ7LTAqT1YLl2uj_4pVLufWiFyJiNNAQkPtjL1_NR4rLlBY5Hb2kHIaE7ERh2JZNa72Wu68zVfqsR2TSPoo4axVgTCNb98XXngBDE39Gmb5fiNGE5kb0THRpBKaCJpNvvalY7cNQr-5LZzw_BkxhupmRtLSvQYZkU36y5ltHVtJ96KkF_rnuYRTR9VlolI50U5PIdnqyFa5qOJU55pvQLWYWgDt6HFLf6zFiGhKFtAXyTrGYBi',
    category: '고전문학',
    publishedDate: '2009년 12월 1일',
    bindingType: '양장본',
    location: 'B4 선반, 세계문학전집',
    description: '재즈 시대의 광기와 아메리칸 드림의 허상을 유려한 문체로 그려낸 20세기 최고의 고전.',
    createdAt: '2026-08-03T11:00:00.000Z',
    updatedAt: '2026-08-24T13:40:00.000Z'
  }
];

export const INITIAL_INVENTORY: Record<string, number> = {
  'book-1': 42,
  'book-2': 2,
  'book-3': 0, // 품절
  'book-4': 1, // 1권 남음
  'book-5': 2, // 2권 남음
  'book-6': 8,
  'book-7': 0, // 품절
  'book-8': 15,
  'book-9': 14
};

export const INITIAL_LOGS: InventoryLog[] = [
  {
    id: 'log-1',
    bookId: 'book-1',
    bookTitle: '미드나잇 라이브러리',
    bookAuthor: '매트 헤이그',
    bookCoverImage: INITIAL_BOOKS[0].coverImage,
    changeQuantity: 5,
    resultingQuantity: 42,
    reason: '입고',
    note: '유통사로부터 도서 입고 및 검수 완료.',
    createdAt: '2026-08-24T10:15:00.000Z'
  },
  {
    id: 'log-2',
    bookId: 'book-6',
    bookTitle: '소년이 온다',
    bookAuthor: '한강',
    bookCoverImage: INITIAL_BOOKS[5].coverImage,
    changeQuantity: -1,
    resultingQuantity: 8,
    reason: '판매',
    note: '매장 내 판매. 영수증 #8492.',
    createdAt: '2026-08-24T09:45:00.000Z'
  },
  {
    id: 'log-3',
    bookId: 'book-9',
    bookTitle: '문학동네 세계문학전집 001: 위대한 개츠비',
    bookAuthor: 'F. 스콧 피츠제럴드',
    bookCoverImage: INITIAL_BOOKS[8].coverImage,
    changeQuantity: 5,
    resultingQuantity: 14,
    reason: '입고',
    note: '정기도서 재입고',
    createdAt: '2026-08-24T08:30:00.000Z'
  },
  {
    id: 'log-4',
    bookId: 'book-1',
    bookTitle: '미드나잇 라이브러리',
    bookAuthor: '매트 헤이그',
    bookCoverImage: INITIAL_BOOKS[0].coverImage,
    changeQuantity: -1,
    resultingQuantity: 37,
    reason: '판매',
    note: '매장 내 판매. 영수증 #8488.',
    createdAt: '2026-08-22T14:30:00.000Z'
  },
  {
    id: 'log-5',
    bookId: 'book-8',
    bookTitle: '도시와 그 불확실한 벽',
    bookAuthor: '무라카미 하루키',
    bookCoverImage: INITIAL_BOOKS[7].coverImage,
    changeQuantity: -2,
    resultingQuantity: 15,
    reason: '판매',
    note: '단골 손님 주문 결제',
    createdAt: '2026-08-23T16:30:00.000Z'
  },
  {
    id: 'log-6',
    bookId: 'book-1',
    bookTitle: '미드나잇 라이브러리',
    bookAuthor: '매트 헤이그',
    bookCoverImage: INITIAL_BOOKS[0].coverImage,
    changeQuantity: -1,
    resultingQuantity: 38,
    reason: '파손',
    note: '아침 재고 확인 중 침수 피해 발견. 판매 가능 재고에서 제외.',
    createdAt: '2026-08-15T09:00:00.000Z'
  }
];

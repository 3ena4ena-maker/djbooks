import React, { useState } from 'react';
import { Book } from '../../types';
import { inventoryStore } from '../../services/inventoryStore';
import { feedback } from '../../utils/feedback';
import { X, Check, BookPlus, Sparkles } from 'lucide-react';

interface AddBookModalProps {
  initialIsbn?: string;
  initialData?: Partial<Book>;
  onClose: () => void;
  onSuccess: (newBookId: string, message: string) => void;
}

export const AddBookModal: React.FC<AddBookModalProps> = ({
  initialIsbn = '',
  initialData,
  onClose,
  onSuccess,
}) => {
  const [isbn, setIsbn] = useState(initialIsbn || initialData?.isbn || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [author, setAuthor] = useState(initialData?.author || '');
  const [publisher, setPublisher] = useState(initialData?.publisher || '');
  const [price, setPrice] = useState<number>(initialData?.price || 15000);
  const [category, setCategory] = useState(initialData?.category || '소설');
  const [bindingType, setBindingType] = useState(initialData?.bindingType || '양장본');
  const [location, setLocation] = useState(initialData?.location || 'A1 선반');
  const [coverImage, setCoverImage] = useState(
    initialData?.coverImage ||
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600'
  );
  const [initialStock, setInitialStock] = useState<number>(5);
  const [description, setDescription] = useState(initialData?.description || '');
  const [isSearching, setIsSearching] = useState(false);

  const handleIsbnLookup = async () => {
    if (!isbn.trim()) return;
    setIsSearching(true);
    try {
      const data = await inventoryStore.lookupExternalBook(isbn);
      if (data) {
        if (data.title) setTitle(data.title);
        if (data.author) setAuthor(data.author);
        if (data.publisher) setPublisher(data.publisher);
        if (data.price) setPrice(data.price);
        if (data.category) setCategory(data.category);
        if (data.coverImage) setCoverImage(data.coverImage);
        feedback.playBeep('success');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) {
      return;
    }

    const newBook = await inventoryStore.registerBook(
      {
        isbn: isbn.trim() || `N/A-${Date.now()}`,
        title: title.trim(),
        author: author.trim(),
        publisher: publisher.trim() || '독립출판',
        price: Number(price) || 0,
        category,
        bindingType,
        location,
        coverImage,
        description,
        publishedDate: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
      },
      initialStock,
      `신규 도서 등록 (초도 재고: ${initialStock}권)`
    );

    feedback.playBeep('success');
    onSuccess(newBook.id, `새로운 도서 '${newBook.title}'이(가) 등록되었습니다.`);
    onClose();
  };

  const samplePresets = [
    {
      isbn: '9788937460005',
      title: '데미안',
      author: '헤르만 헤세',
      publisher: '민음사',
      price: 10000,
      category: '고전문학',
      location: 'B3 선반, 민음사',
      cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600',
    },
    {
      isbn: '9788932917245',
      title: '어린 왕자',
      author: '생텍쥐페리',
      publisher: '열린책들',
      price: 10800,
      category: '소설',
      location: 'A5 선반',
      cover: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600',
    },
    {
      isbn: '9791190313186',
      title: '우리가 빛의 속도로 갈 수 없다면',
      author: '김초엽',
      publisher: '허블',
      price: 14000,
      category: 'SF소설',
      location: 'A3 선반',
      cover: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?auto=format&fit=crop&q=80&w=600',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-[#fbf9f4] w-full max-w-lg rounded-2xl border border-[#c3c7c7] shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#c3c7c7] bg-[#f5f3ee] flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookPlus className="w-5 h-5 text-[#171e1e]" />
            <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-lg font-bold text-[#171e1e]">
              신규 도서 등록
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#737878] hover:text-[#171e1e] hover:bg-[#e4e2dd] rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick presets */}
        <div className="px-5 py-2.5 bg-[#f0eee9] border-b border-[#c3c7c7] flex items-center gap-2 overflow-x-auto text-xs flex-shrink-0">
          <span className="text-[#737878] flex-shrink-0 flex items-center gap-1 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-[#8ea06b]" /> 빠른 채우기:
          </span>
          {samplePresets.map((p) => (
            <button
              key={p.isbn}
              type="button"
              onClick={() => {
                setIsbn(p.isbn);
                setTitle(p.title);
                setAuthor(p.author);
                setPublisher(p.publisher);
                setPrice(p.price);
                setCategory(p.category);
                setLocation(p.location);
                setCoverImage(p.cover);
              }}
              className="px-2.5 py-1 bg-[#ffffff] border border-[#c3c7c7] rounded-md hover:border-[#171e1e] whitespace-nowrap cursor-pointer"
            >
              {p.title}
            </button>
          ))}
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex flex-col gap-4 font-['Public_Sans','Noto_Sans_KR',sans-serif] text-sm">
          {/* ISBN lookup row */}
          <div>
            <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
              ISBN (13자리 바코드)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="예: 9788937460005"
                className="flex-1 px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleIsbnLookup}
                disabled={isSearching}
                className="px-3.5 py-2 bg-[#f5f3ee] border border-[#c3c7c7] rounded-xl hover:bg-[#eae8e3] text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                {isSearching ? '조회 중...' : '정보 조회'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                도서명 *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="도서 제목 입력"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none font-medium"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                저자 *
              </label>
              <input
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="저자명 입력"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                출판사
              </label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="출판사명"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                판매가 (원) *
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                초도 재고
              </label>
              <input
                type="number"
                min="0"
                value={initialStock}
                onChange={(e) => setInitialStock(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-center font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                카테고리
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs"
              >
                <option value="소설">소설</option>
                <option value="에세이">에세이</option>
                <option value="시/희곡">시/희곡</option>
                <option value="인문/사회">인문/사회</option>
                <option value="고전문학">고전문학</option>
                <option value="독립출판">독립출판</option>
                <option value="예술/디자인">예술/디자인</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                서가 위치
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="예: A4 선반"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs"
              >
              </input>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
              표지 이미지 URL
            </label>
            <input
              type="url"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs text-[#434848]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
              도서 소개 (선택)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="간단한 책 소개나 입고 메모"
              className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-[#c3c7c7] rounded-xl text-sm font-semibold text-[#434848] hover:bg-[#eae8e3] transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-[#171e1e] text-white rounded-xl text-sm font-semibold hover:bg-[#2c3333] transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>책 등록하기</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { BookWithStock, SHELF_LOCATIONS } from '../../types';
import { inventoryStore } from '../../services/inventoryStore';
import { getDisplayCategory } from '../../utils/category';
import { CoverImageUploader } from '../common/CoverImageUploader';
import { feedback } from '../../utils/feedback';
import { X, Check, Edit, Sparkles, BookOpen, Bookmark } from 'lucide-react';

interface EditBookModalProps {
  book: BookWithStock;
  onClose: () => void;
  onSuccess: (updatedBook: BookWithStock, message: string) => void;
}

export const EditBookModal: React.FC<EditBookModalProps> = ({
  book,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState(book.title || '');
  const [author, setAuthor] = useState(book.author || '');
  const [publisher, setPublisher] = useState(book.publisher || '');
  const [price, setPrice] = useState<number | ''>(book.price !== undefined ? book.price : '');
  const [category, setCategory] = useState(book.categorySub || getDisplayCategory(book) || '소설');
  const [bindingType, setBindingType] = useState(book.bindingType || '양장본');
  const [location, setLocation] = useState(book.location || 'A1 선반');
  const [publishedDate, setPublishedDate] = useState(
    book.publishedDate || new Date().toISOString().split('T')[0].replace(/-/g, '.')
  );
  const [isbn, setIsbn] = useState(book.isbn || '');
  const [coverImage, setCoverImage] = useState(
    book.coverImage ||
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600'
  );
  const [isReaderPick, setIsReaderPick] = useState(book.isReaderPick || false);
  const [description, setDescription] = useState(book.description || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const updates = {
        title: title.trim(),
        author: author.trim(),
        publisher: publisher.trim() || '독립출판',
        price: price === '' ? 0 : Number(price),
        category,
        bindingType,
        location: location.trim() || 'A1 선반',
        publishedDate,
        isbn: isbn.trim(),
        coverImage,
        isReaderPick,
        description: description.trim(),
      };

      await inventoryStore.updateBook(book.id, updates);
      const updated = inventoryStore.getBookById(book.id);

      feedback.playBeep('success');
      onClose();
      if (updated) {
        onSuccess(updated, `'${title}' 도서 정보가 수정되었습니다.`);
      }
    } catch (err) {
      console.error('Failed to update book:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-[#c3c7c7] flex flex-col font-['Public_Sans','Noto_Sans_KR',sans-serif]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#c3c7c7] flex items-center justify-between bg-[#fbf9f4]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#171e1e] text-white flex items-center justify-center">
              <Edit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-['Playfair_Display','Noto_Serif_KR',serif] text-lg font-bold text-[#171e1e]">
                도서 정보 수정
              </h3>
              <p className="text-xs text-[#737878]">독립출판물 및 기존 등록 도서의 상세 내용을 수정합니다.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#737878] hover:text-[#171e1e] rounded-xl hover:bg-[#f5f3ee] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex flex-col gap-4 text-sm flex-1">
          {/* Cover Image Uploader (Direct file upload / Photo / URL / Presets) */}
          <CoverImageUploader
            value={coverImage}
            onChange={setCoverImage}
            label="도서 표지 (직접 파일 등록/촬영)"
          />

          {/* Title & Author */}
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
                placeholder="도서 제목"
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
                placeholder="저자명"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none"
              />
            </div>
          </div>

          {/* Publisher & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                출판사
              </label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="출판사명 (예: 독립출판, 민음사)"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                판매가 (원)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="판매가 입력 (예: 15000)"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none font-mono"
              />
            </div>
          </div>

          {/* Category, Binding, Location */}
          <div className="grid grid-cols-3 gap-3">
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
                <option value="매거진/잡지">매거진/잡지</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                제본 형태
              </label>
              <select
                value={bindingType}
                onChange={(e) => setBindingType(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs"
              >
                <option value="양장본">양장본</option>
                <option value="무선제본">무선제본</option>
                <option value="중철제본">중철제본</option>
                <option value="페이퍼백">페이퍼백</option>
                <option value="스프링">스프링</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                서가 위치
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs"
              >
                {/* 기존 데이터에 9개 목록 외의 서가 위치가 설정되어 있던 경우 보존 */}
                {location && !SHELF_LOCATIONS.includes(location as any) && (
                  <option value={location}>{location} (기존 위치)</option>
                )}
                {SHELF_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ISBN & Published Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                ISBN / 바코드
              </label>
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="ISBN 또는 자체 관리코드"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
                출간일
              </label>
              <input
                type="text"
                value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)}
                placeholder="예: 2024.05.10"
                className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs"
              />
            </div>
          </div>

          {/* 독자픽 여부 설정 */}
          <div
            onClick={() => setIsReaderPick(!isReaderPick)}
            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
              isReaderPick
                ? 'bg-[#fff8e1] border-[#ffe082]'
                : 'bg-[#faf9f6] border-[#e4e2dd] hover:border-[#c3c7c7]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`p-1.5 rounded-lg ${
                  isReaderPick ? 'bg-[#ffecb3] text-[#b78103]' : 'bg-[#e4e2dd] text-[#737878]'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isReaderPick ? 'fill-[#b78103]' : ''}`} />
              </div>
              <div>
                <div className="text-xs font-bold text-[#171e1e]">독자픽 도서로 지정</div>
                <div className="text-[11px] text-[#737878]">
                  독자서점 추천 도서로 분류되며, 품절 시 대시보드 재고부족 알림 대상이 됩니다.
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isReaderPick}
              onChange={(e) => setIsReaderPick(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 accent-[#b78103] rounded cursor-pointer"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-[#434848] uppercase tracking-wider block mb-1">
              책 소개 / 메모 (선택)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="책 소개, 작가 소개 또는 입고 메모를 작성하세요."
              className="w-full px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl focus:border-[#171e1e] outline-none text-xs resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 mt-auto border-t border-[#f0eee9]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="flex-1 py-3 border border-[#c3c7c7] rounded-xl text-sm font-semibold text-[#434848] hover:bg-[#eae8e3] transition-colors cursor-pointer disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-[#171e1e] text-white rounded-xl text-sm font-semibold hover:bg-[#2c3333] transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? '저장 중...' : '도서 정보 저장'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, Camera, Link, X, Sparkles, Check } from 'lucide-react';

interface CoverImageUploaderProps {
  value: string;
  onChange: (dataUrlOrUrl: string) => void;
  label?: string;
  className?: string;
}

const PRESET_COVERS = [
  {
    name: '감성 소설',
    url: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600',
  },
  {
    name: '자연·에세이',
    url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600',
  },
  {
    name: '예술·디자인',
    url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600',
  },
  {
    name: '고전문학',
    url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600',
  },
  {
    name: 'SF·현대문학',
    url: 'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?auto=format&fit=crop&q=80&w=600',
  },
  {
    name: '독립출판 심플',
    url: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=600',
  },
];

export const CoverImageUploader: React.FC<CoverImageUploaderProps> = ({
  value,
  onChange,
  label = '도서 표지 이미지',
  className = '',
}) => {
  const [tab, setTab] = useState<'upload' | 'url' | 'presets'>('upload');
  const [urlInput, setUrlInput] = useState(value && value.startsWith('http') ? value : '');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Compress & convert file to optimized base64 Data URL
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일(JPG, PNG, WEBP 등)만 업로드할 수 있습니다.');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Target max dimension for book cover (e.g. 800px)
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          onChange(dataUrl);
        } else {
          onChange(event.target?.result as string);
        }
        setIsProcessing(false);
      };
      img.onerror = () => {
        onChange(event.target?.result as string);
        setIsProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      setIsProcessing(false);
      alert('이미지 파일을 읽는데 실패했습니다.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleApplyUrl = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
    }
  };

  const handleRemoveCover = () => {
    onChange('');
    setUrlInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className={`space-y-2.5 font-['Public_Sans','Noto_Sans_KR',sans-serif] ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-[#434848] uppercase tracking-wider">
          {label}
        </label>
        <span className="text-[11px] text-[#737878]">독립출판물 직접 촬영 / 파일 첨부 가능</span>
      </div>

      <div className="bg-[#fbf9f4] p-3.5 rounded-2xl border border-[#c3c7c7] space-y-3">
        {/* Mode Selector Tabs */}
        <div className="flex bg-[#f0eee9] p-1 rounded-xl gap-1 text-xs">
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'upload'
                ? 'bg-white text-[#171e1e] shadow-xs'
                : 'text-[#737878] hover:text-[#171e1e]'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>파일 업로드 / 촬영</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('url')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'url'
                ? 'bg-white text-[#171e1e] shadow-xs'
                : 'text-[#737878] hover:text-[#171e1e]'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>웹 URL 입력</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('presets')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'presets'
                ? 'bg-white text-[#171e1e] shadow-xs'
                : 'text-[#737878] hover:text-[#171e1e]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#8ea06b]" />
            <span>추천 표지</span>
          </button>
        </div>

        {/* Current Preview & Control Area */}
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* Cover Preview */}
          <div className="relative aspect-[2/3] w-24 sm:w-28 rounded-xl overflow-hidden border border-[#c3c7c7] bg-[#ffffff] shadow-xs flex-shrink-0 group">
            {value ? (
              <>
                <img
                  src={value}
                  alt="도서 표지 미리보기"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  title="표지 삭제"
                  className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-[#ba1a1a] text-white rounded-full transition-all cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-[#737878] p-2 text-center bg-[#f0eee9]">
                <ImageIcon className="w-6 h-6 mb-1 text-[#c3c7c7]" />
                <span className="text-[10px] leading-tight">표지 없음</span>
              </div>
            )}
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 w-full min-w-0">
            {tab === 'upload' && (
              <div className="space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />

                {/* Dropzone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                    isDragging
                      ? 'border-[#171e1e] bg-[#f0eee9]'
                      : 'border-[#c3c7c7] hover:border-[#737878] bg-white'
                  }`}
                >
                  <UploadCloud className="w-5 h-5 text-[#737878]" />
                  <p className="text-xs font-semibold text-[#171e1e]">
                    {isProcessing ? '이미지 처리 중...' : '이미지 파일을 여기에 끌어다 놓거나 클릭'}
                  </p>
                  <p className="text-[11px] text-[#737878]">
                    PNG, JPG, WEBP 지원 (자동 최적화)
                  </p>
                </div>

                {/* Direct Action Buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-1.5 px-3 bg-white border border-[#c3c7c7] hover:bg-[#f5f3ee] rounded-xl text-xs font-semibold text-[#434848] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>내 파일 선택</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 py-1.5 px-3 bg-white border border-[#c3c7c7] hover:bg-[#f5f3ee] rounded-xl text-xs font-semibold text-[#434848] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>사진 직접 촬영</span>
                  </button>
                </div>
              </div>
            )}

            {tab === 'url' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/cover.jpg"
                    className="flex-1 px-3 py-2 bg-white border border-[#c3c7c7] rounded-xl text-xs focus:border-[#171e1e] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-3 py-2 bg-[#171e1e] text-white rounded-xl text-xs font-semibold hover:bg-[#2c3333] cursor-pointer"
                  >
                    적용
                  </button>
                </div>
                <p className="text-[11px] text-[#737878]">
                  외부 웹사이트나 출판사에서 제공하는 고화질 표지 URL을 입력하세요.
                </p>
              </div>
            )}

            {tab === 'presets' && (
              <div className="space-y-2">
                <p className="text-[11px] text-[#737878]">
                  마음에 드는 표지 템플릿을 선택해보세요:
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {PRESET_COVERS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => onChange(preset.url)}
                      className={`p-1.5 rounded-lg border text-left flex items-center gap-1.5 text-[11px] transition-all cursor-pointer ${
                        value === preset.url
                          ? 'border-[#171e1e] bg-white font-bold text-[#171e1e]'
                          : 'border-[#e4e2dd] bg-white/70 hover:bg-white text-[#434848]'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.name}
                        className="w-5 h-7 object-cover rounded-xs flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <span className="truncate flex-1">{preset.name}</span>
                      {value === preset.url && <Check className="w-3 h-3 text-[#3c4c20]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

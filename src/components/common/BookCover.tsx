import React, { useState } from 'react';

interface BookCoverProps {
  src?: string;
  alt: string;
  className?: string;
  aspectRatio?: 'book' | 'square';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const BookCover: React.FC<BookCoverProps> = ({
  src,
  alt,
  className = '',
  aspectRatio = 'book',
  size = 'md',
}) => {
  const [hasError, setHasError] = useState(false);

  const fallbackImage =
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=600';

  const sizeClasses = {
    sm: 'w-10 h-14',
    md: 'w-12 h-16',
    lg: 'w-20 h-28',
    xl: 'w-full aspect-[2/3]',
  }[size];

  return (
    <div
      className={`relative overflow-hidden rounded bg-[#f0eee9] border border-[#c3c7c7] flex-shrink-0 select-none ${sizeClasses} ${className}`}
      style={{
        boxShadow:
          'inset 3px 0 6px -1px rgba(0, 0, 0, 0.18), inset -1px 0 2px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Book spine line overlay */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-black/10 z-10 pointer-events-none" />

      <img
        src={hasError || !src ? fallbackImage : src}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
};

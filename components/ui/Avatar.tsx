// components/ui/Avatar.tsx
import Image from 'next/image';
import { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  clickable?: boolean;
}

export function Avatar({ src, alt, size = 'md', onClick, clickable = false }: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleClick = () => {
    if (clickable && src && !imageError && onClick) {
      onClick();
    }
  };

  const avatarContent = !src || imageError ? (
    <div className={`${sizeClasses[size]} bg-gray-300 rounded-full flex items-center justify-center`}>
      <span className={`${textSizes[size]} font-medium text-gray-700`}>
        {getInitials(alt)}
      </span>
    </div>
  ) : (
    <div className={`relative ${sizeClasses[size]}`}>
      <Image
        src={src}
        alt={alt}
        fill
        className="rounded-full object-cover border-2 border-gray-300"
        sizes={`${size === 'sm' ? '32px' : size === 'md' ? '48px' : '64px'}`}
        onError={() => setImageError(true)}
      />
    </div>
  );

  return (
    <div 
      className={`${clickable && src && !imageError ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
      onClick={handleClick}
    >
      {avatarContent}
    </div>
  );
}
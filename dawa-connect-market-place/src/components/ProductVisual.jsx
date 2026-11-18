'use client';

import { useState } from 'react';

export default function ProductVisual({ image, name = '', className = '' }) {
  const source = typeof image === 'string' && /^https:\/\//i.test(image) ? image : '';
  const [failedSource, setFailedSource] = useState('');

  if (source && failedSource !== source) {
    return (
      <span className={`relative flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden ${className}`}>
        <img
          src={source}
          alt={`${name || 'Medicine'} product`}
          className="absolute inset-0 block h-full w-full max-h-full max-w-full object-contain p-2"
          loading="lazy"
          onError={() => setFailedSource(source)}
        />
      </span>
    );
  }
  return <span className={`flex h-full w-full items-center justify-center overflow-hidden ${className}`} aria-hidden="true">{typeof image === 'string' && image && !source ? image : '\u{1F48A}'}</span>;
}

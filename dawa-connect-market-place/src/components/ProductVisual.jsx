'use client';

import { useState } from 'react';

export default function ProductVisual({ image, name = '', className = '' }) {
  const source = typeof image === 'string' && /^https:\/\//i.test(image) ? image : '';
  const [failedSource, setFailedSource] = useState('');

  if (source && failedSource !== source) {
    return (
      <img
        src={source}
        alt={`${name || 'Medicine'} product`}
        className={`h-full w-full object-contain ${className}`}
        loading="lazy"
        onError={() => setFailedSource(source)}
      />
    );
  }
  return <span className={className} aria-hidden="true">{typeof image === 'string' && image && !source ? image : '\u{1F48A}'}</span>;
}

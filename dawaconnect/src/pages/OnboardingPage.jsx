import React, { useState } from 'react';

const SLIDES = [
  {
    title: 'Welcome to DawaConnect Desktop',
    text: 'Manage your pharmacy from one secure desktop application.',
    icon: '💊',
  },
  {
    title: 'Track Inventory in Real Time',
    text: 'Add products, monitor stock, and get low-stock alerts quickly.',
    icon: '📦',
  },
  {
    title: 'Handle Orders and Analytics',
    text: 'Process customer orders and monitor performance from your dashboard.',
    icon: '📊',
  },
];

export default function OnboardingPage({ onFinish }) {
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 560, width: '100%' }}>
        <div className="card-body" style={{ textAlign: 'center', padding: 36 }}>
          <div style={{ fontSize: 58, marginBottom: 10 }}>{slide.icon}</div>
          <h2 style={{ fontFamily: 'Sora, sans-serif', marginBottom: 8 }}>{slide.title}</h2>
          <p style={{ color: '#64748b', marginBottom: 20 }}>{slide.text}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            {SLIDES.map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === index ? 24 : 8,
                  height: 8,
                  borderRadius: 999,
                  background: i === index ? '#0d9488' : '#cbd5e1',
                  transition: 'all .2s ease',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {index > 0 && (
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setIndex(index - 1)}>
                Back
              </button>
            )}
            <button
              className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => (isLast ? onFinish() : setIndex(index + 1))}
            >
              {isLast ? 'Start Registration' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

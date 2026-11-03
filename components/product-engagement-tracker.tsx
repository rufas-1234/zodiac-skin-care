"use client";

import { useEffect, useRef } from 'react';

type Props = {
  productId: number;
};

export function ProductEngagementTracker({ productId }: Props) {
  const eventId = useRef<{ productId: number; value: string } | null>(null);

  useEffect(() => {
    if (eventId.current?.productId !== productId) {
      eventId.current = { productId, value: crypto.randomUUID() };
    }
    const visitId = eventId.current.value;
    let activeSince = document.visibilityState === 'visible' ? performance.now() : null;
    let activeMilliseconds = 0;

    const record = (durationSeconds: number) => {
      fetch('/api/products/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, visitId, durationSeconds }),
        keepalive: true,
      }).then((response) => {
        if (!response.ok) {
          console.error('Unable to record product engagement:', response.status);
        }
      }).catch((error: unknown) => {
        console.error('Unable to record product engagement:', error);
      });
    };

    const updateVisibility = () => {
      if (document.visibilityState === 'visible') {
        activeSince ??= performance.now();
      } else if (activeSince !== null) {
        activeMilliseconds += performance.now() - activeSince;
        activeSince = null;
      }
    };
    const currentDuration = () =>
      Math.min(86_400, Math.floor(
        (activeMilliseconds + (activeSince === null ? 0 : performance.now() - activeSince)) / 1000,
      ));
    const finishVisit = () => record(currentDuration());

    record(0);
    document.addEventListener('visibilitychange', updateVisibility);
    window.addEventListener('pagehide', finishVisit);

    return () => {
      updateVisibility();
      finishVisit();
      document.removeEventListener('visibilitychange', updateVisibility);
      window.removeEventListener('pagehide', finishVisit);
    };
  }, [productId]);

  return null;
}

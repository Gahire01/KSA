"use client";

import * as React from "react";

/**
 * Diagonal, tiled watermark over the paper: "{name} · {student number} · {HH:MM}".
 *
 * It deters screenshots by making every capture traceable to the trainee and the
 * minute it was taken; it cannot prevent one. The time is regenerated every 60
 * seconds so a captured frame carries its own timestamp. pointer-events are off, so
 * it never gets in the way of answering.
 */

const TILE_COLUMNS = 4;
const TILE_ROWS = 9;

function clock(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function ExamWatermark({ traineeName, studentNumber }: { traineeName: string; studentNumber: string }) {
  const [time, setTime] = React.useState(clock);

  React.useEffect(() => {
    const id = window.setInterval(() => setTime(clock()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const label = `${traineeName} · ${studentNumber} · ${time}`;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden select-none"
      style={{ opacity: 0.06 }}
    >
      <div className="absolute -inset-[40%] flex -rotate-[24deg] flex-col justify-around">
        {Array.from({ length: TILE_ROWS }).map((_, row) => (
          <div
            key={row}
            className="flex justify-around whitespace-nowrap font-mono text-lg font-semibold text-black"
            style={{ transform: `translateX(${row % 2 === 0 ? 0 : 6}rem)` }}
          >
            {Array.from({ length: TILE_COLUMNS }).map((__, col) => (
              <span key={col} className="px-8">
                {label}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

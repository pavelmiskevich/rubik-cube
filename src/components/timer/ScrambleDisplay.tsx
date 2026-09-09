"use client";

import { useCallback, useEffect, useState } from "react";
import { generateScramble } from "@/lib/scrambler";

interface ScrambleDisplayProps {
  /** Notified with every scramble, so a timer can record the one being solved. */
  onChange?: (scramble: string) => void;
}

export default function ScrambleDisplay({ onChange }: ScrambleDisplayProps) {
  // The scramble is random, so it cannot be produced during render: the server
  // and the client would disagree and hydration would fail. It is generated
  // once the component is mounted on the client instead.
  const [scramble, setScramble] = useState("");

  const regenerate = useCallback(() => {
    const next = generateScramble();
    setScramble(next);
    onChange?.(next);
  }, [onChange]);

  useEffect(() => {
    // react-hooks/set-state-in-effect is right in general, but the first
    // scramble genuinely cannot exist before mount: generating it during
    // render would either desync hydration or, if the page is prerendered,
    // freeze one scramble into the static HTML for every visitor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    regenerate();
  }, [regenerate]);

  return (
    <div className="w-full max-w-2xl mx-auto text-center p-4">
      <div
        data-testid="scramble"
        aria-live="polite"
        aria-label="Скрамбл"
        className="text-2xl font-mono tracking-wider text-gray-800 bg-gray-100 p-4 rounded-lg shadow-inner"
      >
        {scramble || "Генерация..."}
      </div>
      <button
        type="button"
        onClick={regenerate}
        data-testid="new-scramble"
        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        Новый скрамбл
      </button>
    </div>
  );
}

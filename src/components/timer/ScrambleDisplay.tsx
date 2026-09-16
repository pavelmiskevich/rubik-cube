"use client";

import { useCallback, useEffect, useState } from "react";
import { generateScramble } from "@/lib/scrambler";
import Button from "@/components/ui/Button";

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
    <div className="mx-auto w-full max-w-2xl space-y-4 text-center">
      <div
        data-testid="scramble"
        aria-live="polite"
        aria-label="Скрамбл"
        /* Длинный скрамбл на узком экране должен переноситься, а не растягивать
           страницу. */
        className="break-words rounded-card border bg-surface-2 p-4 font-mono text-xl tracking-wider"
      >
        {scramble || "Генерация..."}
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={regenerate}
        data-testid="new-scramble"
      >
        Новый скрамбл
      </Button>
    </div>
  );
}

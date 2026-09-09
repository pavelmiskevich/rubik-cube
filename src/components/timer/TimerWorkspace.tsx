"use client";

import { useState } from "react";
import ScrambleDisplay from "./ScrambleDisplay";
import SmartTimer from "./SmartTimer";

interface TimerWorkspaceProps {
  canSave: boolean;
}

/**
 * Holds the scramble the timer is solving. Solve.scramble is a required column
 * and was being written as an empty string, so the history recorded times with
 * no idea what was scrambled.
 */
export default function TimerWorkspace({ canSave }: TimerWorkspaceProps) {
  const [scramble, setScramble] = useState("");

  return (
    <>
      <ScrambleDisplay onChange={setScramble} />
      <SmartTimer scramble={scramble} canSave={canSave} />
    </>
  );
}

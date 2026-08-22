"use client";

import { useState, useEffect } from "react";
import { generateScramble } from "@/lib/scrambler";

export default function ScrambleDisplay() {
  const [scramble, setScramble] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setScramble(generateScramble()), 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto text-center p-4">
      <div className="text-2xl font-mono tracking-wider text-gray-800 bg-gray-100 p-4 rounded-lg shadow-inner">
        {scramble || "Генерация..."}
      </div>
      <button 
        onClick={() => setScramble(generateScramble())}
        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        Новый скрамбл
      </button>
    </div>
  );
}

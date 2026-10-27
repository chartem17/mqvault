"use client";

import { useEffect, useState } from "react";
import InkBackground from "@/components/backgrounds/profit";

const WORDS = ["PROFIT", "SUCCESS", "FUNDED"];

export function HeaderInk() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % WORDS.length), 9000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative hidden h-14 w-52 overflow-hidden rounded-lg border border-border md:block">
      <InkBackground
        accent="oklch(0.72 0.19 150)"
        className="h-full w-full"
        text={WORDS[i]}
      >
        {null}
      </InkBackground>
    </div>
  );
}

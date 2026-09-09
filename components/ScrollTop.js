"use client";
import { useEffect, useState } from "react";

export default function ScrollTop({ label }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      className="scroll-top"
      data-show={show}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={label}
      title={label}
    >
      ↑
    </button>
  );
}

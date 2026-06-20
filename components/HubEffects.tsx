"use client";

import { useEffect } from "react";

export default function HubEffects() {
  useEffect(() => {
    const nav = document.getElementById("nav");
    const onScroll = () => nav?.classList.toggle("scrolled", window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const reveals = [...document.querySelectorAll<HTMLElement>(".reveal")];
    reveals.forEach((el, i) => {
      el.classList.add("js-anim");
      el.style.transitionDelay = Math.min(i % 6, 5) * 65 + "ms";
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -30px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
    const fallback = setTimeout(() => reveals.forEach((el) => el.classList.add("in")), 1600);

    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  return null;
}

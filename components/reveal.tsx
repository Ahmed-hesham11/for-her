"use client";

import { Children, cloneElement, isValidElement, useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";

const TRANSITION = `opacity var(--duration-slow) var(--ease-premium), transform var(--duration-slow) var(--ease-premium)`;

// Progressive enhancement, not a loading gate: every child is already in the
// server-rendered HTML and fully visible by default. On mount, if an
// element isn't already in view (and the user hasn't asked for reduced
// motion), it's briefly hidden and then faded up the moment it scrolls into
// view — one IntersectionObserver per container, not one per item. If JS
// never runs at all, nothing here ever executes and the content simply
// stays visible, exactly as server-rendered.
function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = node.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
    if (alreadyVisible) return;

    setHidden(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHidden(false);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, hidden };
}

// Single-block fade-up, revealed once when scrolled into view.
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, hidden } = useScrollReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: hidden ? 0 : 1,
        transform: hidden ? "translateY(16px)" : "translateY(0)",
        transition: TRANSITION,
      }}
    >
      {children}
    </div>
  );
}

// Same reveal, applied per-child with a short stagger — for card grids.
// Clones each child rather than wrapping it, so grid items (including
// col-span/row-span classes) stay direct children of the grid container.
export function StaggerReveal({ children, className, maxStagger = 7 }: { children: ReactNode; className?: string; maxStagger?: number }) {
  const { ref, hidden } = useScrollReveal<HTMLDivElement>();

  return (
    <div ref={ref} className={className}>
      {Children.map(children, (child, index) => {
        if (!isValidElement(child)) return child;
        const element = child as ReactElement<{ style?: CSSProperties }>;
        return cloneElement(element, {
          style: {
            ...(element.props.style ?? {}),
            opacity: hidden ? 0 : 1,
            transform: hidden ? "translateY(16px)" : "translateY(0)",
            transition: TRANSITION,
            transitionDelay: hidden ? "0ms" : `${Math.min(index, maxStagger) * 55}ms`,
          },
        });
      })}
    </div>
  );
}

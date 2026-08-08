# Feature: Immersive Cinematic Scene Layer

> Branch: `wedding_invitation` · Status: In progress

## Summary

An immersive, cinematic visual layer for the Evoke homepage that makes the whole
site feel like a single, living wedding "scene" rather than a stack of static
sections. It adds a **global 3D backdrop** (interlocking gold wedding rings
drifting through a field of golden particles), **per-section decorative auras**,
and **scroll-driven motion** (parallax drift + entrance reveals) — all layered
behind transparent content so one cohesive 3D world shows through the entire
page.

This is a presentational / experiential enhancement. It changes how the existing
homepage *feels*, not what it *says* — no content, routing, or data model changes.

## Why we're building it

Evoke sells **premium** invitation websites. The landing page has to look and
feel high-end from the first scroll. A shared, physics-y 3D backdrop plus subtle
motion signals craftsmanship and differentiates the product from generic
template builders — reinforcing the price point and the "personalized, memorable
event" promise.

## What it includes

| Piece | Path | Role |
| --- | --- | --- |
| `RingsScene` | `src/app/shared/graphics/rings-scene.ts` | Framework-agnostic Three.js scene: two gold rings + particle field. Owns and disposes all GPU resources. |
| `SceneBackdropComponent` | `src/app/core/layouts/scene-backdrop/` | Angular wrapper: one fixed, transparent WebGL canvas behind the whole app. Drives the scene's lifecycle, feeds pointer + scroll parallax. |
| `SectionAuraComponent` | `src/app/shared/components/section-aura/` | Decorative soft gold blobs per section that drift on scroll (echo the hero). `aria-hidden`, non-interactive. |
| `ParallaxDirective` | `src/app/shared/directives/parallax.directive.ts` | Transform-only scroll parallax driven by `ViewportService.scrollY` (no extra listeners). |
| `RevealDirective` | `src/app/shared/directives/reveal.directive.ts` | IntersectionObserver fade/rise entrance; optional child staggering for grids. |

The backdrop is mounted once in `MainLayoutComponent` (behind an `@defer (on idle)`)
at `z-index: 0`; the shell/nav/footer stack above it and sections stay transparent
so the 3D layer shows through.

## How it behaves

- **Global backdrop:** a single fixed WebGL canvas — not a canvas per section —
  so the whole site shares one parallax world. Edges are masked with a radial
  gradient to keep text readable.
- **Scroll evolution:** normalized scroll progress (0 top → 1 bottom) sweeps the
  rings' rotation and float, so the composition evolves as the visitor moves down.
- **Pointer parallax:** rings/particles/camera tilt gently toward the cursor.
- **Reveals:** sections fade and rise into place as they enter the viewport;
  grids can cascade their children.

## Non-negotiables (already built in)

- **SSR-safe:** browser-only init via `afterNextRender`; no direct `window` use
  (goes through the `WINDOW` token). Fails silently if WebGL is unavailable.
- **Performance:** one `requestAnimationFrame` loop, paused when the tab is
  hidden; pixel ratio capped at 2; transform/opacity-only animations; parallax
  reuses the shared `ViewportService` scroll signal (no new scroll listeners).
- **Reduced motion:** `prefers-reduced-motion` → one static frame, parallax and
  reveals disabled entirely.
- **Accessibility:** all decorative layers are `aria-hidden` + `pointer-events:
  none`; reveal hidden-state is applied from JS so no-JS / no-IO keeps content
  fully visible (no FOUC or hidden text).
- **Cleanup:** all GPU resources, timers, and listeners released on destroy.

## Design tokens

Reuses the Evoke gold palette — ring gold `#C9A227`, sand `#E8C88A`, warm glow
`#FFCE6B` — consistent with the existing dark/light theme system.

## Out of scope

- No changes to homepage copy, sections, routing, or content data.
- No per-section 3D scenes (deliberately one shared backdrop).
- Not yet wired into the (scaffolded) auth/dashboard areas.

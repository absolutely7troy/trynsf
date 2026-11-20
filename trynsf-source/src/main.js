const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------
   Header edge appears once content scrolls underneath it
---------------------------------------------------------------- */
const header = document.getElementById('site-header');
const scrollTop = document.getElementById('scroll-top');
const onScroll = () => {
  const y = window.scrollY;
  header?.toggleAttribute('data-scrolled', y > 8);
  if (scrollTop) {
    const visible = y > 420;
    scrollTop.toggleAttribute('data-visible', visible);
    scrollTop.setAttribute('aria-hidden', String(!visible));
    scrollTop.tabIndex = visible ? 0 : -1;
  }
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();
scrollTop?.addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

/* ---------------------------------------------------------------
   Mobile menu
---------------------------------------------------------------- */
const menuBtn = document.getElementById('menu-btn');
const menu = document.getElementById('mobile-menu');
const setMenu = (open) => {
  menu.classList.toggle('hidden', !open);
  menuBtn.setAttribute('aria-expanded', String(open));
};
menuBtn?.addEventListener('click', () => setMenu(menu.classList.contains('hidden')));
menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu && !menu.classList.contains('hidden')) {
    setMenu(false);
    menuBtn.focus();
  }
});

/* ---------------------------------------------------------------
   Scroll reveals: one entrance per container, non-uniform stagger.
   Gaps shrink as the group goes on so it reads as a wave; only the
   first handful stagger, the rest arrive with the last one.
---------------------------------------------------------------- */
const GAPS = [0, 90, 75, 65, 55, 50];
const delayFor = (i) => GAPS.slice(0, Math.min(i, GAPS.length - 1) + 1).reduce((a, b) => a + b, 0);

document.querySelectorAll('[data-stagger]').forEach((group) => {
  [...group.children].forEach((child, i) => child.style.setProperty('--d', `${delayFor(i)}ms`));
});
document.querySelectorAll('[data-bars] .bar').forEach((bar, i) => {
  // Rows 0/140/260ms, the comparison bar trails its NSF bar by 70ms
  const row = Math.floor(i / 2);
  bar.style.setProperty('--d', `${[0, 140, 260][row] + (i % 2) * 70}ms`);
});

const revealTargets = document.querySelectorAll('[data-reveal], [data-stagger], [data-bars]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
  );
  revealTargets.forEach((el) => io.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add('is-in'));
}

/* ---------------------------------------------------------------
   Research library filters
---------------------------------------------------------------- */
const chips = document.querySelectorAll('.chip');
const studies = [...document.querySelectorAll('#library [data-tags]')];
const hasTag = (el, tag) => el.dataset.tags.split(' ').includes(tag);

document.querySelectorAll('[data-count]').forEach((el) => {
  const tag = el.dataset.count;
  el.textContent = tag === 'all' ? studies.length : studies.filter((s) => hasTag(s, tag)).length;
});

chips.forEach((chip) =>
  chip.addEventListener('click', () => {
    if (chip.getAttribute('aria-pressed') === 'true') return;
    const tag = chip.dataset.f;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    let shown = 0;
    for (const study of studies) {
      const show = tag === 'all' || hasTag(study, tag);
      study.hidden = !show;
      if (!show || reduceMotion) continue;
      // Results swap in quickly so the list never feels like it teleported.
      // Fast (220ms) because people filter several times in a row.
      study.getAnimations().forEach((a) => a.cancel());
      study.animate(
        [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 220, delay: Math.min(shown, 5) * 30, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' }
      );
      shown++;
    }
  })
);

/* ---------------------------------------------------------------
   Before/after sliders, plus a one-time hint that they can be dragged
---------------------------------------------------------------- */
const sliders = [...document.querySelectorAll('.ba')];
sliders.forEach((ba) => {
  const input = ba.querySelector('input');
  const stopHint = () => ba.classList.remove('hint');
  const update = () => ba.style.setProperty('--pos', `${input.value}%`);
  input.addEventListener('input', () => { stopHint(); update(); });
  ba.addEventListener('pointerdown', stopHint);
  ba.addEventListener('animationend', stopHint);
  update();
});
if (!reduceMotion && sliders.length && 'IntersectionObserver' in window) {
  const hintIO = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const i = sliders.indexOf(entry.target);
        entry.target.style.setProperty('--d', `${600 + i * 160}ms`);
        entry.target.classList.add('hint');
        hintIO.unobserve(entry.target);
      }
    },
    { threshold: 0.6 }
  );
  sliders.forEach((s) => hintIO.observe(s));
}

/* ---------------------------------------------------------------
   Particle fields (hero + footer).
   Only animate while on screen and the tab is visible;
   reduced motion gets one still frame.
---------------------------------------------------------------- */
function particleField(canvas, opts) {
  if (!canvas?.getContext) return;
  const ctx = canvas.getContext('2d');
  const ratio = Math.min(devicePixelRatio || 1, 2);
  let w = 0, h = 0, dots = [], raf = 0, onScreen = false;

  const seed = () => {
    const count = Math.round(Math.min(opts.max, Math.max(opts.min, (w * h) / opts.density)));
    dots = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * opts.size + 0.6,
      vx: (Math.random() - 0.5) * opts.speed,
      vy: (Math.random() - 0.5) * opts.speed,
      a: Math.random() * 0.45 + opts.alpha,
    }));
  };

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    if (opts.glow) {
      const g = ctx.createRadialGradient(w * 0.75, h * 0.35, 0, w * 0.75, h * 0.35, Math.max(w, h) * 0.6);
      g.addColorStop(0, 'rgba(90,140,210,.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y, d = dx * dx + dy * dy;
        if (d < opts.link) {
          ctx.strokeStyle = `rgba(190,206,224,${0.12 * (1 - d / opts.link)})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(dots[i].x, dots[i].y);
          ctx.lineTo(dots[j].x, dots[j].y);
          ctx.stroke();
        }
      }
    }
    for (const p of dots) {
      const g = ctx.createRadialGradient(p.x - p.r * 0.4, p.y - p.r * 0.4, 0, p.x, p.y, p.r * 2.2);
      g.addColorStop(0, `rgba(255,255,255,${p.a})`);
      g.addColorStop(0.5, `rgba(190,202,216,${p.a * 0.7})`);
      g.addColorStop(1, 'rgba(150,165,182,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const step = () => {
    for (const p of dots) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
    }
    draw();
    raf = requestAnimationFrame(step);
  };

  const start = () => { if (!raf && !reduceMotion && onScreen && !document.hidden) raf = requestAnimationFrame(step); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    w = rect.width; h = rect.height;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    seed();
    draw();
  };

  resize();
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    opts.onVisibility?.(onScreen);
    onScreen ? start() : stop();
  }).observe(canvas);
}

const heroSection = document.getElementById('particles')?.closest('section');
particleField(document.getElementById('particles'), {
  min: 40, max: 110, density: 14000, size: 2.2, speed: 0.44, alpha: 0.35, link: 11000, glow: true,
  onVisibility: (v) => heroSection?.classList.toggle('is-offscreen', !v),
});
particleField(document.getElementById('footer-particles'), {
  min: 28, max: 64, density: 18000, size: 1.7, speed: 0.32, alpha: 0.2, link: 9000, glow: false,
});

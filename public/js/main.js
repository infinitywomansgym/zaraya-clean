// Nav scroll + progress bar
window.addEventListener('scroll', () => {
  document.getElementById('navbar')?.classList.toggle('scrolled', scrollY > 60);
  const bar = document.getElementById('scrollBar');
  if (bar) {
    const h = document.documentElement;
    const pct = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
    bar.style.width = pct + '%';
  }
});

// Particles
function initParticles() {
  const pc = document.getElementById('particles');
  if (!pc) return;
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left              = Math.random() * 100 + '%';
    p.style.animationDuration = (8 + Math.random() * 12) + 's';
    p.style.animationDelay    = (Math.random() * 15) + 's';
    p.style.width = p.style.height = (1 + Math.random() * 2.5) + 'px';
    pc.appendChild(p);
  }
}

// Scroll reveal
function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.rv').forEach(el => obs.observe(el));
}

// Marquee
function initMarquee() {
  const mt = document.getElementById('mtrack');
  if (mt) mt.innerHTML += mt.innerHTML;
}

// Mobile burger menu
function initBurger() {
  const burger = document.getElementById('navBurger');
  const mob    = document.getElementById('navMob');
  const close  = document.getElementById('navMobClose');
  if (!burger || !mob) return;
  const shut   = () => { mob.classList.remove('open'); document.body.style.overflow = ''; };
  const toggle = () => {
    const isOpen = mob.classList.toggle('open');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };
  burger.addEventListener('click', toggle);
  if (close) close.addEventListener('click', shut);
  mob.querySelectorAll('a').forEach(a => a.addEventListener('click', shut));
}

// Soft gold cursor-glow trail (desktop, fine pointer only)
function initCursorGlow() {
  if (!window.matchMedia('(pointer:fine)').matches) return;
  const dot = document.createElement('div');
  dot.className = 'cur-dot';
  const ring = document.createElement('div');
  ring.className = 'cur-ring';
  document.body.append(dot, ring);
  let mx = 0, my = 0, rx = 0, ry = 0;
  window.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top = my + 'px';
  });
  (function loop() {
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    ring.style.left = rx + 'px';
    ring.style.top = ry + 'px';
    requestAnimationFrame(loop);
  })();
  document.querySelectorAll('a, button, .cat-card').forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('big'));
    el.addEventListener('mouseleave', () => ring.classList.remove('big'));
  });
}

// Magnetic 3D tilt on category cards
function initTilt() {
  if (!window.matchMedia('(pointer:fine)').matches) return;
  document.querySelectorAll('.cat-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.classList.add('tilting');
      card.style.transform = `perspective(900px) rotateX(${(-py * 7).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg) translateY(-8px) scale(1.015)`;
    });
    card.addEventListener('mouseleave', () => {
      card.classList.remove('tilting');
      card.style.transform = '';
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initReveal();
  initMarquee();
  initBurger();
  initCursorGlow();
  initTilt();
});

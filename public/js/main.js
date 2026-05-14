// Nav scroll
window.addEventListener('scroll', () => {
  document.getElementById('navbar')?.classList.toggle('scrolled', scrollY > 60);
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

document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initReveal();
  initMarquee();
});

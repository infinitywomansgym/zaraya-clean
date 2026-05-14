document.addEventListener('DOMContentLoaded', () => {
  // Reveal cards
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); obs.unobserve(e.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('.rv').forEach(el => obs.observe(el));

  // Sort — re-navigate with sort param
  const sortSel = document.getElementById('sortSel');
  if (sortSel) {
    const params = new URLSearchParams(window.location.search);
    sortSel.value = params.get('sort') || 'default';
    sortSel.addEventListener('change', () => {
      params.set('sort', sortSel.value);
      window.location.search = params.toString();
    });
  }
});

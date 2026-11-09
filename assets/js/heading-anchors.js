document.querySelectorAll('.post-content :is(h1, h2, h3, h4, h5, h6)[id]').forEach((heading) => {
  const anchor = document.createElement('a');
  anchor.className = 'heading-anchor';
  anchor.href = '#' + encodeURIComponent(heading.id);
  anchor.setAttribute('aria-label', 'Permalink to ' + heading.textContent.trim());
  anchor.textContent = '#';
  heading.append(' ', anchor);
});

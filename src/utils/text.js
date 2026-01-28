function truncateText(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(maxLength - 3, 0))}...`;
}

function slugifyProjectName(name, fallbackSeed) {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length > 0) {
    return slug.slice(0, 95);
  }

  return `project-${fallbackSeed}`;
}

function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes} minute(s)`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return `${hours}h ${remainingMinutes}m`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h ${remainingMinutes}m`;
}

module.exports = {
  truncateText,
  slugifyProjectName,
  formatDuration,
};

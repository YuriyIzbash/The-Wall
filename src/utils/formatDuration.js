export const formatDuration = (ms) => {
  if (ms < 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const remainingMinutes = minutes % 60;

  if (days > 0) {
    if (remainingHours > 0) return `${days}d ${remainingHours}h`;
    return `${days}d`;
  }
  if (hours > 0) {
    if (remainingMinutes > 0) return `${hours}h ${remainingMinutes}min`;
    return `${hours}h`;
  }
  if (minutes > 0) return `${minutes}min`;
  return `${seconds}s`;
};
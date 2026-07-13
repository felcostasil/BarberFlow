import { useI18n } from 'vue-i18n';

/**
 * Shared time formatting utilities.
 * Import from this module instead of duplicating in each component.
 */
export function useTimeUtils() {
  const { t } = useI18n();

  /**
   * Returns a human-readable relative time string for a given timestamp.
   * e.g. "just now", "1 min ago", "5 mins ago"
   */
  const formatTimeAgo = (timestamp: number): string => {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMins === 0) return t('common.justNow');
    if (diffMins === 1) return t('common.minAgo');
    return t('common.minsAgo', { count: diffMins });
  };

  /**
   * Returns a formatted HH:MM time string from a timestamp.
   */
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return { formatTimeAgo, formatTime };
}

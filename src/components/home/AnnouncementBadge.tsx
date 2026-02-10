import React from 'react';

export type AnnouncementCategory = 'info' | 'update' | 'maintenance';

const styles: Record<AnnouncementCategory, string> = {
  info: 'bg-blue-50 text-blue-600',
  update: 'bg-emerald-50 text-emerald-600',
  maintenance: 'bg-rose-50 text-rose-600',
};

const labels: Record<AnnouncementCategory, string> = {
  info: 'Info',
  update: 'Update',
  maintenance: 'Maint',
};

export function AnnouncementBadge({
  type,
  className = '',
}: {
  type: AnnouncementCategory;
  className?: string;
}) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${styles[type]} ${className}`}>
      {labels[type]}
    </span>
  );
}

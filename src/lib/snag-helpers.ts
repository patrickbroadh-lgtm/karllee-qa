export type SnagStatus = 'open' | 'in_progress' | 'resolved';

export function canManageSnag(role: string | null | undefined): boolean {
  return role === 'director' || role === 'admin' || role === 'site_manager';
}

export function snagStatusLabel(status: SnagStatus): string {
  switch (status) {
    case 'open': return 'Open';
    case 'in_progress': return 'In progress';
    case 'resolved': return 'Resolved';
  }
}

export const SNAG_STATUSES: readonly SnagStatus[] = ['open', 'in_progress', 'resolved'];

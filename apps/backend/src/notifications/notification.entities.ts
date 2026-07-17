export type NotificationType =
  | 'application_received'
  | 'application_selected'
  | 'application_not_selected'
  | 'gig_started'
  | 'gig_completed'
  | 'gig_cancelled';

export interface UserNotification {
  id: string;
  userId: string;
  type: NotificationType;
  titleMl: string;
  titleEn: string;
  bodyMl: string;
  bodyEn: string;
  gigId?: string;
  dedupeKey: string;
  pushStatus: 'pending' | 'sent' | 'failed' | 'not_configured';
  readAt?: string;
  createdAt: string;
}

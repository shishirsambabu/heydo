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

export type PushPlatform = 'android' | 'ios';
export type PushDeliveryStatus =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'invalid_token'
  | 'not_configured';

export interface PushDevice {
  id: string;
  userId: string;
  platform: PushPlatform;
  tokenFingerprint: string;
  encryptedToken: string;
  locale: 'ml' | 'en';
  active: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPushDevice {
  id: string;
  platform: PushPlatform;
  locale: 'ml' | 'en';
  active: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PushDelivery {
  id: string;
  notificationId: string;
  deviceId: string;
  status: PushDeliveryStatus;
  attempts: number;
  providerMessageId?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

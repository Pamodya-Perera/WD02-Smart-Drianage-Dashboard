import type { AlertEvent } from '../data/types';

const MUTE_KEY = 'drain.muted';

export function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

export type PermissionState = NotificationPermission | 'unsupported';

export function currentPermission(): PermissionState {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export async function askPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.requestPermission();
}

/** Only escalations are worth a system notification; "back to normal" stays in-app. */
export function shouldNotify(e: AlertEvent): boolean {
  return e.severity === 'warning' || e.severity === 'critical';
}

export function showSystemNotification(e: AlertEvent, deviceName: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(`${deviceName}: ${e.title}`, { body: e.detail, tag: e.kind });
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}

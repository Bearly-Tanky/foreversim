import clsx from 'clsx';

export type NoticeLevel = 'info' | 'warning' | 'error';

export const NOTICE_ICON: Record<NoticeLevel, string> = {
	info: 'fa-info-circle',
	warning: 'fa-exclamation-triangle',
	error: 'fa-exclamation-triangle',
};

export const NOTICE_COLOR: Record<NoticeLevel, string> = {
	info: 'text-off-white text-shadow-glow-link',
	warning: 'text-link-warning text-shadow-glow-danger',
	error: 'text-danger text-shadow-glow-offwhite',
};

export const noticeIconClass = (level: NoticeLevel) => clsx('fa', NOTICE_ICON[level], NOTICE_COLOR[level]);

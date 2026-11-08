import type { SVGProps } from 'react';

export type IconName =
  | 'drop'
  | 'thermo'
  | 'download'
  | 'bell'
  | 'bell-off'
  | 'moon'
  | 'sun'
  | 'sliders'
  | 'x'
  | 'arrow-up'
  | 'arrow-down'
  | 'dash'
  | 'grid'
  | 'activity'
  | 'cloud-rain'
  | 'cpu'
  | 'triangle'
  | 'alert-circle';

const PATHS: Record<IconName, string> = {
  drop: 'M12 3.5c3.2 4 5.5 6.8 5.5 10a5.5 5.5 0 0 1-11 0c0-3.2 2.3-6 5.5-10Z',
  thermo: 'M10 14.2V5a2 2 0 1 1 4 0v9.2a4 4 0 1 1-4 0Z',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 19h14',
  bell: 'M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5Z M10 20.5a2 2 0 0 0 4 0',
  'bell-off': 'M6 16.5V11a6 6 0 0 1 .9-3.2M18 11v5.5l1.5 1.5h-11 M10 20.5a2 2 0 0 0 4 0 M4 4l16 16',
  moon: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6',
  sliders: 'M4 7h9m4 0h3M4 17h3m4 0h9M13 4.5v5M7 14.5v5',
  x: 'M6 6l12 12M18 6 6 18',
  'arrow-up': 'M12 19V6m0 0-5 5m5-5 5 5',
  'arrow-down': 'M12 5v13m0 0-5-5m5 5 5-5',
  dash: 'M6 12h12',
  grid: 'M4 4h6.5v6.5H4z M13.5 4H20v6.5h-6.5z M4 13.5h6.5V20H4z M13.5 13.5H20V20h-6.5z',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  'cloud-rain': 'M7 14.5a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 18.5 7.5 3.5 3.5 0 0 1 18 14.5 M8 17.5v2.5 M12 16.5v3.5 M16 17.5v2.5',
  cpu: 'M7 7h10v10H7z M10.5 10.5h3v3h-3z M9.5 3v4 M14.5 3v4 M9.5 17v4 M14.5 17v4 M3 9.5h4 M3 14.5h4 M17 9.5h4 M17 14.5h4',
  triangle: 'M12 4 2.8 19.5h18.4L12 4Z M12 10v4.5 M12 17.2v.1',
  'alert-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 8v4.5 M12 15.8v.1',
};

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 16, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

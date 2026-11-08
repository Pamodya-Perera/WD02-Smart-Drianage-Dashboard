export interface Phase {
  /** Simulated seconds. */
  seconds: number;
  /** Rain intensity 0..1. */
  rain: number;
  /** Fraction of normal drain capacity that is open, 0..1. */
  open: number;
  label: string;
}

export interface Scenario {
  id: string;
  label: string;
  hint: string;
  phases: Phase[];
  /** Real seconds the device drops off Wi-Fi. */
  wifiDropSeconds?: number;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'normal',
    label: 'Normal flow',
    hint: 'Dry weather, drain fully open',
    phases: [{ seconds: 1, rain: 0, open: 1, label: 'Dry' }],
  },
  {
    id: 'light-rain',
    label: 'Light rain',
    hint: 'Level climbs but stays under the warning line',
    phases: [
      { seconds: 600, rain: 0.35, open: 1, label: 'Light rain' },
      { seconds: 600, rain: 0, open: 1, label: 'Clearing' },
    ],
  },
  {
    id: 'heavy-rain',
    label: 'Heavy rain',
    hint: 'Rapid rise through Warning into Critical',
    phases: [
      { seconds: 900, rain: 1, open: 1, label: 'Downpour' },
      { seconds: 900, rain: 0, open: 1, label: 'Draining' },
    ],
  },
  {
    id: 'blockage',
    label: 'Drain blockage',
    hint: 'Rain stops but the level will not fall',
    phases: [
      { seconds: 480, rain: 0.7, open: 0.4, label: 'Rain on restricted drain' },
      { seconds: 1800, rain: 0, open: 0.5, label: 'Rain stopped, drain restricted' },
    ],
  },
  {
    id: 'wifi-drop',
    label: 'Wi-Fi drop',
    hint: 'Device goes offline for 15 s, then reconnects',
    phases: [{ seconds: 1, rain: 0, open: 1, label: 'Dry' }],
    wifiDropSeconds: 15,
  },
];

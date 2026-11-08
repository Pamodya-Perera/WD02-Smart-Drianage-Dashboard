import { fmtDateTime, fmtDuration } from '../lib/format';
import { useNow } from '../lib/hooks';
import { useDashboard } from '../state/DashboardProvider';
import { LeaderRow, Leaders } from '../ui/Leaders';
import { Section } from '../ui/Section';
import s from './Device.module.css';

const CONTRACT = `/devices/drain-01
  latest/                 overwritten on every reading
    waterLevel   23.5     cm, depth of water in the drain
    distance     46.5     cm, raw ultrasonic reading
    rainDetected true
    temperature  29.1     °C
    riseRate     1.2      cm/min (negative while falling)
    status       "WARNING"   NORMAL | WARNING | CRITICAL
    blockage     false
    timestamp    1731070000000   epoch ms
  history/<pushId>/       same fields, one entry per reading
                          (add ".indexOn": "timestamp" in the rules)
  config/
    warningLevel 30   criticalLevel 45   rapidRiseRate 2
    drainDepth 60     sensorHeight 70
    blockageLevel 20  blockageHoldMin 5`;

export function Device() {
  const {
    device,
    config,
    sourceName,
    connection,
    lastReceivedAt,
    latest,
    readingsReceived,
    sessionStart,
    expectedIntervalMs,
    muted,
    setMuted,
    permission,
    requestPermission,
  } = useDashboard();
  const now = useNow(1000);

  const connLabel = connection === 'live' ? 'Live' : connection === 'offline' ? 'Offline' : 'Connecting';
  const permLabel =
    permission === 'granted'
      ? 'Allowed'
      : permission === 'denied'
        ? 'Blocked in browser settings'
        : permission === 'unsupported'
          ? 'Not supported here'
          : 'Not enabled';

  return (
    <div className={s.page}>
      <p className={s.intro}>Where the readings come from, and the limits the ESP32 works to.</p>

      <div className={s.cols}>
        <Section title="1. Identity">
          <Leaders>
            <LeaderRow label="Device ID" value={device.id} mono />
            <LeaderRow label="Name" value={device.name} />
            <LeaderRow label="Location" value={device.location} />
          </Leaders>
        </Section>

        <Section title="2. Connection">
          <Leaders>
            <LeaderRow label="State" value={connLabel} />
            <LeaderRow label="Data source" value={sourceName === 'mock' ? 'Built-in simulator' : 'Firebase Realtime Database'} />
            <LeaderRow label="Last reading" value={latest ? fmtDateTime(latest.timestamp) : 'none yet'} mono />
            <LeaderRow label="Last received" value={lastReceivedAt ? `${fmtDuration(now - lastReceivedAt)} ago` : 'none yet'} mono />
            <LeaderRow label="Expected every" value={fmtDuration(expectedIntervalMs)} mono />
            <LeaderRow label="Readings this session" value={String(readingsReceived)} mono />
            <LeaderRow label="Session length" value={fmtDuration(now - sessionStart)} mono />
          </Leaders>
        </Section>

        <Section title="3. Thresholds on the ESP32">
          <Leaders>
            <LeaderRow label="Warning level" value={`${config.warningLevel} cm`} mono />
            <LeaderRow label="Critical level" value={`${config.criticalLevel} cm`} mono />
            <LeaderRow label="Rapid rise" value={`${config.rapidRiseRate} cm/min`} mono />
            <LeaderRow label="Blockage level" value={`${config.blockageLevel} cm`} mono />
            <LeaderRow label="Blockage wait after rain" value={`${config.blockageHoldMin} min`} mono />
            <LeaderRow label="Drain depth" value={`${config.drainDepth} cm`} mono />
            <LeaderRow label="Sensor height" value={`${config.sensorHeight} cm`} mono />
          </Leaders>
          <p className={s.note}>
            The ESP32 decides Normal, Warning and Critical so the LEDs and buzzer still work without Wi-Fi. This dashboard only shows what it
            reports.
          </p>
        </Section>

        <Section title="4. Alerts on this screen">
          <Leaders>
            <LeaderRow label="In-app alerts" value={muted ? 'Muted' : 'On'} />
            <LeaderRow label="Browser notifications" value={permLabel} />
          </Leaders>
          <div className={s.actions}>
            <button type="button" className="btn" onClick={() => setMuted(!muted)}>
              {muted ? 'Unmute alerts' : 'Mute alerts'}
            </button>
            {permission === 'default' ? (
              <button type="button" className="btn" onClick={requestPermission}>
                Enable browser notifications
              </button>
            ) : null}
          </div>
          <p className={s.note}>
            Warnings and criticals appear here and, if allowed, as system notifications while this page is open. SMS or email to authorities
            needs a server-side service and isn't part of this dashboard.
          </p>
        </Section>
      </div>

      <Section title="5. Data contract for the ESP32 firmware">
        <details className={s.details}>
          <summary>Show the Firebase layout the dashboard reads</summary>
          <pre className={`${s.pre} mono`}>{CONTRACT}</pre>
        </details>
      </Section>
    </div>
  );
}

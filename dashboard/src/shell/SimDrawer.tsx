import { useEffect, useState } from 'react';
import { fmtDuration } from '../lib/format';
import { SPEED_OPTIONS, simulator, type SimSnapshot } from '../sim/engine';
import { SCENARIOS } from '../sim/scenarios';
import { useDashboard } from '../state/DashboardProvider';
import { Icon } from '../ui/Icon';
import s from './SimDrawer.module.css';

export function SimDrawer({ onClose }: { onClose: () => void }) {
  const { config } = useDashboard();
  const [snap, setSnap] = useState<SimSnapshot | null>(null);

  useEffect(() => simulator.subscribeState(setSnap), []);

  if (!snap) return null;
  const running = snap.scenarioId !== 'normal';

  return (
    <aside className={s.drawer} aria-label="Simulator controls">
      <header className={s.head}>
        <div>
          <div className={s.headTitle}>Demo simulator</div>
          <div className={s.sub}>Stands in for the ESP32 until the hardware is connected.</div>
        </div>
        <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close simulator">
          <Icon name="x" size={16} />
        </button>
      </header>

      <section className={s.section}>
        <h3>Scenario</h3>
        <div className={s.scenarios}>
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              type="button"
              className={`${s.scenario} ${snap.scenarioId === sc.id && sc.id !== 'normal' ? s.current : ''}`}
              onClick={() => simulator.runScenario(sc.id)}
            >
              <span className={s.scName}>{sc.label}</span>
              <span className={s.scHint}>{sc.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={s.section}>
        <h3>Speed</h3>
        <div className="tabs" role="group" aria-label="Simulation speed">
          {SPEED_OPTIONS.map((v) => (
            <button key={v} type="button" className="tab-btn" onClick={() => simulator.setSpeed(v)} aria-pressed={snap.speed === v}>
              {v}×
            </button>
          ))}
        </div>
      </section>

      <section className={s.section}>
        <h3>Set water level</h3>
        <input
          className={s.slider}
          type="range"
          min={0}
          max={config.drainDepth}
          step={0.5}
          value={Math.round(snap.level * 2) / 2}
          onChange={(e) => simulator.setLevel(Number(e.target.value))}
          aria-label="Water level in centimetres"
        />
        <div className={`${s.sliderRow} num`}>
          <span>0</span>
          <span>{snap.level.toFixed(1)} cm</span>
          <span>{config.drainDepth}</span>
        </div>
        <p className={s.note}>Jumps the water to that depth. The drain physics carry on from there.</p>
      </section>

      <section className={`${s.section} ${s.state}`}>
        <h3>Right now</h3>
        <dl className={s.dl}>
          <dt>Phase</dt>
          <dd>{running ? `${snap.phaseLabel} (${Math.min(snap.phaseIndex + 1, snap.phaseCount)}/${snap.phaseCount})` : 'Idle, dry weather'}</dd>
          {running ? (
            <>
              <dt>Phase ends in</dt>
              <dd className="num">{fmtDuration(snap.phaseRemainingS * 1000)} sim time</dd>
            </>
          ) : null}
          <dt>Rain intensity</dt>
          <dd className="num">{Math.round(snap.rain * 100)}%</dd>
          <dt>Drain capacity</dt>
          <dd className="num">{Math.round(snap.open * 100)}%</dd>
          {snap.offlineRemainingS > 0 ? (
            <>
              <dt>Wi-Fi</dt>
              <dd className="num">dropped, back in {snap.offlineRemainingS}s</dd>
            </>
          ) : null}
        </dl>
      </section>
    </aside>
  );
}

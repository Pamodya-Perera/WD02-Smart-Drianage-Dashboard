import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { fmtDuration, fmtTime } from '../lib/format';
import { useNow, useTheme } from '../lib/hooks';
import { useDashboard } from '../state/DashboardProvider';
import { Icon } from '../ui/Icon';
import s from './AppShell.module.css';
import { SimDrawer } from './SimDrawer';
import { Toasts } from './Toasts';

const SIM_KEY = 'drain.simOpen';

function readSimOpen(): boolean {
  try {
    return localStorage.getItem(SIM_KEY) === '1';
  } catch {
    return false;
  }
}

function ConnectionMark() {
  const { connection, lastReceivedAt, readingsReceived } = useDashboard();
  const now = useNow(1000);
  const ago = lastReceivedAt ? fmtDuration(now - lastReceivedAt) : null;

  if (connection === 'offline') {
    return (
      <div className={`${s.conn} ${s.connOff}`} role="status">
        <span className={s.dot} />
        Offline{ago ? <span className={s.connSub}> · {ago}</span> : null}
      </div>
    );
  }
  if (connection === 'connecting') {
    return (
      <div className={s.conn} role="status">
        <span className={`${s.dot} ${s.wait}`} />
        Connecting
      </div>
    );
  }
  return (
    <div className={`${s.conn} ${s.connOn}`} role="status">
      <span key={readingsReceived} className={`${s.dot} ${s.pulse}`} />
      Live
    </div>
  );
}

export function AppShell() {
  const { latest, alerts, sourceName, muted, setMuted, error } = useDashboard();
  const [theme, toggleTheme] = useTheme();
  const [simOpen, setSimOpen] = useState(readSimOpen);

  const toggleSim = () => {
    const next = !simOpen;
    setSimOpen(next);
    try {
      localStorage.setItem(SIM_KEY, next ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
  };

  const horizon = latest ? latest.timestamp - 24 * 3600_000 : 0;
  const recent = alerts.filter((a) => a.severity !== 'info' && a.timestamp >= horizon).length;
  const isMock = sourceName === 'mock';

  return (
    <div className={s.app}>
      <header className={s.mast}>
        <div className={s.mastTop}>
          <div className={s.brand}>
            <span className={s.wordmark}>Drain Monitor</span>
            <span className={s.sub}>Group WD-02 · IT1040</span>
          </div>

          <div className={s.tools}>
            <ConnectionMark />
            {latest ? (
              <div className={s.stamp} title={isMock ? 'The simulator runs on its own clock, faster than real time at 5x and 20x.' : 'Time of the last reading'}>
                <span className={s.stampLabel}>{isMock ? 'Sim clock' : 'Last reading'}</span>
                <span className="mono">{fmtTime(latest.timestamp)}</span>
              </div>
            ) : null}
            {isMock ? (
              <button type="button" className="btn" onClick={toggleSim} aria-pressed={simOpen}>
                <Icon name="sliders" />
                <span className={s.btnText}>Simulator</span>
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => setMuted(!muted)}
              aria-pressed={muted}
              aria-label={muted ? 'Unmute alerts' : 'Mute alerts'}
              title={muted ? 'Alerts muted' : 'Alerts on'}
            >
              <Icon name={muted ? 'bell-off' : 'bell'} />
            </button>
            <button
              type="button"
              className="btn btn-icon"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Day sheet' : 'Night sheet'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </div>
        </div>

        <nav className={s.nav} aria-label="Sections">
          <NavLink to="/" end className={({ isActive }) => `${s.link} ${isActive ? s.active : ''}`}>
            Overview
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `${s.link} ${isActive ? s.active : ''}`}>
            History
          </NavLink>
          <NavLink to="/alerts" className={({ isActive }) => `${s.link} ${isActive ? s.active : ''}`}>
            Alerts
            {recent > 0 ? (
              <sup className={`${s.count} mono`} title="Warnings and criticals in the last 24 hours">
                {recent}
              </sup>
            ) : null}
          </NavLink>
          <NavLink to="/device" className={({ isActive }) => `${s.link} ${isActive ? s.active : ''}`}>
            Device
          </NavLink>
        </nav>
      </header>

      <main className={s.main}>
        {error ? (
          <div className={s.fatal} role="alert">
            <h2 className="serif">Can't reach the data source</h2>
            <p>{error}</p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      <footer className={s.footer}>
        <span>SLIIT · IT1040 Fundamentals of Computing · Smart Drainage Monitoring and Flood Detection</span>
        <span className="mono">source: {sourceName}</span>
      </footer>

      {isMock && simOpen ? <SimDrawer onClose={toggleSim} /> : null}
      <Toasts clearOfDrawer={isMock && simOpen} />
    </div>
  );
}

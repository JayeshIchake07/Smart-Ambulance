import React, { useState, useEffect } from 'react';
import api, { getSocket } from '../services/api';
import HospitalNavigationMap from '../components/HospitalNavigationMap';

// ── Design Tokens ──────────────────────────────────────────────────────────
const c = {
  primary:   '#007AFF',
  emergency: '#FF3B30',
  safe:      '#34C759',
  warning:   '#FF9500',
  bgLight:   '#F2F2F7',
  cardWhite: '#FFFFFF',
  textDark:  '#1C1C1E',
  textGray:  '#6C6C70',
  border:    '#D1D1D6',
};

// ── Inline Styles ──────────────────────────────────────────────────────────
const css = {
  page: { minHeight: '100vh', background: c.bgLight, fontFamily: 'inherit' },
  header: {
    background: c.cardWhite,
    borderBottom: `1px solid ${c.border}`,
    padding: '0 28px',
    height: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoText: { fontSize: 18, fontWeight: 700, color: c.textDark },
  livePill: {
    background: '#34C75920',
    border: `1px solid ${c.safe}`,
    color: c.safe,
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 20,
    letterSpacing: 1,
  },
  body: { maxWidth: 1200, margin: '0 auto', padding: 24 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 },
  statCard: {
    background: c.cardWhite,
    borderRadius: 14,
    padding: '18px 20px',
    border: `1px solid ${c.border}`,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 },
  section: {
    background: c.cardWhite,
    borderRadius: 16,
    border: `1px solid ${c.border}`,
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  },
  sectionHeader: {
    padding: '14px 20px',
    borderBottom: `1px solid ${c.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: c.textDark },
  emergencyCard: {
    padding: '16px 20px',
    borderBottom: `1px solid ${c.border}`,
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  typeBadge: (color) => ({
    background: `${color}20`,
    color,
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 6,
  }),
  readyBtn: (ready) => ({
    background: ready ? '#34C75920' : c.primary,
    color: ready ? c.safe : '#fff',
    border: ready ? `1px solid ${c.safe}` : 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 12,
    fontWeight: 700,
    cursor: ready ? 'default' : 'pointer',
    whiteSpace: 'nowrap',
  }),
};

// Type → color mapping
const TYPE_COLORS = {
  Cardiac: '#FF3B30', Stroke: '#FF6B35', Accident: '#FF9500',
  Breathing: '#5E5CE6', Injury: '#FF9500', Unknown: '#8E8E93',
};
const TYPE_EMOJIS = {
  Cardiac: '❤️', Stroke: '🧠', Accident: '🚗',
  Breathing: '🫁', Injury: '🩹', Unknown: '🆘',
};

const pickRoute = (nextRoute, currentRoute) => (
  Array.isArray(nextRoute) && nextRoute.length > 1 ? nextRoute : currentRoute || []
);

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const [emergencies, setEmergencies] = useState([]);
  const [readyMap, setReadyMap] = useState({}); // emergencyId → bool
  const [stats, setStats] = useState({ active: 0, beds: 75, enRoute: 0, avgResponse: 7 });
  const [connected, setConnected] = useState(false);
  const [hospitalName, setHospitalName] = useState('Lilavati Hospital');
  const [hospital, setHospital] = useState(null);

  // Login + socket setup
  useEffect(() => {
    const init = async () => {
      try {
        // Auto-login
        let token = localStorage.getItem('hospitalToken');
        if (!token) {
          const res = await api.post('/api/auth/login', { email: 'hospital@test.com', password: '123456' });
          token = res.data.token;
          localStorage.setItem('hospitalToken', token);
        }

        // Load hospital data
        const hospRes = await api.get('/api/hospital');
        if (hospRes.data.length > 0) {
          setHospital(hospRes.data[0]);
          setHospitalName(hospRes.data[0].name);
          setStats((s) => ({ ...s, beds: hospRes.data[0].availableBeds }));
        }
      } catch (err) {
        console.error('Init error:', err.message);
      }
    };
    init();
  }, []);

  // Socket connection
  useEffect(() => {
    const socket = getSocket();

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('register', { userId: 'hospital-staff', role: 'hospital' });
    });

    socket.on('disconnect', () => setConnected(false));

    // New patient alert
    socket.on('hospital-alert', (data) => {
      console.log('📨 Hospital alert received:', data);
      setEmergencies((prev) => {
        const exists = prev.find((e) => e.emergencyId === data.emergencyId);
        if (exists) return prev;
        return [{
          ...data,
          patientType: data.patientType || data.emergencyType || 'Unknown',
          route: data.route || [],
          routeToHospital: data.routeToHospital || [],
          receivedAt: new Date(),
        }, ...prev];
      });
      setStats((s) => ({ ...s, active: s.active + 1, enRoute: s.enRoute + 1 }));
    });

    // Patient picked up - update ETA info
    socket.on('patient-arrived', (data) => {
      setEmergencies((prev) =>
        prev.map((e) =>
          e.emergencyId === data.emergencyId
            ? {
                ...e,
                patientType: data.patientType || e.patientType,
                status: 'arriving',
                ambulanceETA: data.ambulanceETA,
                ambulanceLocation: data.ambulanceLocation,
                hospitalId: data.hospitalId || e.hospitalId,
                hospitalLocation: data.hospitalLocation || e.hospitalLocation,
                victimLocation: data.victimLocation || e.victimLocation,
                route: pickRoute(data.route, e.route),
                routeToHospital: pickRoute(data.routeToHospital, e.routeToHospital),
              }
            : e
        )
      );
    });

    socket.on('hospital-ambulance-location', (data) => {
      setEmergencies((prev) =>
        prev.map((e) =>
          e.emergencyId === data.emergencyId
            ? {
                ...e,
                patientType: data.patientType || e.patientType,
                status: data.status || e.status,
                ambulanceETA: data.eta ?? e.ambulanceETA,
                ambulanceLocation: { lat: data.lat, lng: data.lng },
                hospitalId: data.hospitalId || e.hospitalId,
                hospitalName: data.hospitalName || e.hospitalName,
                hospitalLocation: data.hospitalLocation || e.hospitalLocation,
                victimLocation: data.victimLocation || e.victimLocation,
                route: pickRoute(data.route, e.route),
                routeToHospital: pickRoute(data.routeToHospital, e.routeToHospital),
                ambulance: data.ambulance || e.ambulance,
              }
            : e
        )
      );
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('hospital-alert');
      socket.off('patient-arrived');
      socket.off('hospital-ambulance-location');
    };
  }, []);

  const handleMarkReady = (emergencyId) => {
    const socket = getSocket();
    socket.emit('hospital-ready', { emergencyId });
    setReadyMap((prev) => ({ ...prev, [emergencyId]: true }));
  };

  const statItems = [
    { label: 'Active Emergencies', value: stats.active, emoji: '🚨', color: c.emergency },
    { label: 'Beds Available',     value: stats.beds,   emoji: '🛏️', color: c.primary },
    { label: 'Ambulances En Route',value: stats.enRoute,emoji: '🚑', color: c.warning },
    { label: 'Avg Response (min)', value: stats.avgResponse, emoji: '⏱️', color: c.safe },
  ];

  const trackedEmergency =
    emergencies.find((em) => em.status === 'arriving' && em.ambulanceLocation) ||
    emergencies.find((em) => em.ambulanceLocation) ||
    emergencies[0] ||
    null;

  return (
    <div style={css.page}>
      {/* Header */}
      <header style={css.header}>
        <div style={css.logo}>
          <span style={{ fontSize: 24 }}>🚑</span>
          <span style={css.logoText}>RapidAid — {hospitalName}</span>
          <span style={css.livePill}>{connected ? '● LIVE' : '○ OFFLINE'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: c.textGray, fontSize: 13 }}>Hospital Dashboard</span>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: c.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14,
          }}>H</div>
        </div>
      </header>

      <div style={css.body}>
        {/* Stats */}
        <div style={css.statsRow}>
          {statItems.map((s) => (
            <div key={s.label} style={css.statCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{s.emoji}</span>
                <span style={{ fontSize: 10, color: c.textGray, textTransform: 'uppercase', letterSpacing: 0.5 }}>LIVE</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginBottom: 2 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: c.textGray }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Two Column Layout */}
        <div style={css.twoCol}>
          {/* Emergencies List */}
          <div style={css.section}>
            <div style={css.sectionHeader}>
              <span style={css.sectionTitle}>🚨 Active Emergencies</span>
              <span style={{ fontSize: 12, color: c.textGray }}>{emergencies.length} incoming</span>
            </div>

            {emergencies.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: c.textGray }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📡</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Waiting for alerts</div>
                <div style={{ fontSize: 12 }}>Emergency alerts will appear here in real-time</div>
              </div>
            ) : (
              emergencies.map((em) => {
                const typeColor = TYPE_COLORS[em.patientType] || c.textGray;
                const isReady = readyMap[em.emergencyId];
                return (
                  <div key={em.emergencyId} style={css.emergencyCard}>
                    {/* Type Icon */}
                    <div style={{
                      width: 46, height: 46, borderRadius: 12, background: `${typeColor}15`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
                    }}>
                      {TYPE_EMOJIS[em.patientType] || '🆘'}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: c.textDark }}>{em.patientType || 'Unknown'} Emergency</span>
                        <span style={css.typeBadge(typeColor)}>{em.patientType}</span>
                      </div>
                      <div style={{ fontSize: 12, color: c.textGray, marginBottom: 4 }}>
                        🚑 Ambulance ETA: <strong style={{ color: c.textDark }}>{em.ambulanceETA || '?'} min</strong>
                        &nbsp;&nbsp;•&nbsp;&nbsp;
                        ID: <span style={{ fontFamily: 'monospace', color: c.primary }}>#{em.emergencyId?.slice(-6).toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: 11, color: c.textGray }}>
                        Received: {em.receivedAt ? new Date(em.receivedAt).toLocaleTimeString() : '—'}
                        {em.status === 'arriving' && (
                          <span style={{ marginLeft: 8, color: c.warning, fontWeight: 600 }}>• Patient en route</span>
                        )}
                      </div>
                    </div>

                    {/* Ready Button */}
                    <button
                      style={css.readyBtn(isReady)}
                      onClick={() => !isReady && handleMarkReady(em.emergencyId)}
                      disabled={isReady}
                    >
                      {isReady ? '✓ Ready' : 'Mark Ready'}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Live Map */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={css.section}>
              <div style={css.sectionHeader}>
                <span style={css.sectionTitle}>🗺️ Live Navigation</span>
              </div>
              <HospitalNavigationMap
                emergency={trackedEmergency}
                hospitalLocation={hospital?.location || trackedEmergency?.hospitalLocation}
                hospitalName={hospital?.name || trackedEmergency?.hospitalName}
              />
            </div>

            {/* Hospital Status Card */}
            <div style={css.section}>
              <div style={css.sectionHeader}>
                <span style={css.sectionTitle}>🏥 Hospital Status</span>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Available Beds', value: `${stats.beds} beds`, color: c.safe },
                  { label: 'Emergency Wing', value: 'Operational', color: c.safe },
                  { label: 'ICU Status', value: 'Available', color: c.safe },
                  { label: 'Trauma Team', value: 'On Standby', color: c.warning },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: c.textGray }}>{item.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

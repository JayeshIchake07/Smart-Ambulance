import React, { useEffect, useRef, useState } from 'react';
import api, { getSocket } from '../services/api';

const c = {
  primary: '#007AFF',
  emergency: '#FF3B30',
  safe: '#34C759',
  warning: '#FF9500',
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  gray: '#6C6C70',
  border: '#D1D1D6',
};

const CENTRAL_MUMBAI = { lat: 19.076, lng: 72.8777 };
const ACTIVE_STATUSES = ['pending', 'dispatched', 'driver_accepted', 'en_route_to_victim', 'patient_picked_up', 'en_route_to_hospital', 'arriving'];

const TYPE_META = {
  Cardiac: { emoji: '❤️', color: '#FF3B30' },
  Stroke: { emoji: '🧠', color: '#FF6B35' },
  Accident: { emoji: '🚗', color: '#FF9500' },
  Breathing: { emoji: '🫁', color: '#5E5CE6' },
  Injury: { emoji: '🩹', color: '#FF9500' },
  Unknown: { emoji: '🆘', color: '#8E8E93' },
};

function isActiveEmergency(status) {
  return ACTIVE_STATUSES.includes(status || 'pending');
}

function isToday(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(lat2 - lat1);
  const deltaLng = toRad(lng2 - lng1);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBedColor(availableBeds) {
  if (availableBeds > 15) {
    return c.safe;
  }
  if (availableBeds >= 5) {
    return c.warning;
  }
  return c.emergency;
}

function getEmergencyMeta(type) {
  return TYPE_META[type] || TYPE_META.Unknown;
}

function getEmergencyStatusMeta(status) {
  switch (status) {
    case 'patient_picked_up':
    case 'en_route_to_hospital':
    case 'arriving':
      return { label: 'Arriving', color: c.emergency, bg: `${c.emergency}15` };
    case 'driver_accepted':
    case 'en_route_to_victim':
      return { label: 'En Route', color: c.warning, bg: `${c.warning}18` };
    case 'dispatched':
    default:
      return { label: 'Dispatched', color: c.primary, bg: `${c.primary}15` };
  }
}

function getAmbulanceColor(status) {
  if (status === 'available') {
    return c.safe;
  }
  if (status === 'dispatched') {
    return c.warning;
  }
  if (status === 'busy') {
    return c.emergency;
  }
  return c.gray;
}

function getAmbulanceStatusFromEmergency(status) {
  if (status === 'patient_picked_up' || status === 'en_route_to_hospital' || status === 'arriving') {
    return 'busy';
  }
  if (status === 'completed' || status === 'cancelled') {
    return 'available';
  }
  return 'dispatched';
}

function pickRoute(nextRoute, currentRoute) {
  return Array.isArray(nextRoute) && nextRoute.length > 1 ? nextRoute : currentRoute || [];
}

function normalizeEmergencyStatus(status) {
  if (status === 'patient_picked_up') {
    return 'arriving';
  }
  return status || 'dispatched';
}

function normalizeEmergency(record) {
  if (!record) {
    return null;
  }

  const hospitalObject = record.hospital && typeof record.hospital === 'object' ? record.hospital : null;
  const ambulanceObject = record.ambulance && typeof record.ambulance === 'object' ? record.ambulance : null;
  const hospitalId = record.hospitalId || hospitalObject?._id || record.hospital || null;
  const ambulanceId = record.ambulanceId || ambulanceObject?._id || record.ambulance || null;
  const ambulanceLocation = record.ambulanceLocation || ambulanceObject?.location || null;

  return {
    emergencyId: record.emergencyId || record._id,
    emergencyType: record.emergencyType || record.patientType || 'Unknown',
    patientType: record.patientType || record.emergencyType || 'Unknown',
    status: normalizeEmergencyStatus(record.status),
    ambulanceETA: toNumber(record.ambulanceETA ?? record.eta, 0),
    hospitalId,
    hospitalName: record.hospitalName || hospitalObject?.name || 'Unassigned Hospital',
    hospitalAddress: record.hospitalAddress || hospitalObject?.address || 'Address unavailable',
    hospitalLocation: record.hospitalLocation || hospitalObject?.location || null,
    victimLocation: record.victimLocation || null,
    ambulanceLocation: ambulanceLocation
      ? { lat: toNumber(ambulanceLocation.lat), lng: toNumber(ambulanceLocation.lng) }
      : null,
    ambulance: ambulanceId
      ? {
          _id: ambulanceId,
          vehicle: record.ambulanceVehicle || ambulanceObject?.vehicle || 'Ambulance',
          type: record.ambulanceType || ambulanceObject?.type || 'BLS',
          driverName: record.driverName || ambulanceObject?.driverName || ambulanceObject?.driver?.name || 'Driver',
          status: record.ambulanceStatus || ambulanceObject?.status || getAmbulanceStatusFromEmergency(record.status),
        }
      : null,
    route: Array.isArray(record.route) ? record.route : [],
    routeToHospital: Array.isArray(record.routeToHospital) ? record.routeToHospital : [],
    receivedAt: record.receivedAt || record.createdAt || new Date().toISOString(),
    hospitalReady: Boolean(record.hospitalReady),
    createdAt: record.createdAt || record.receivedAt || new Date().toISOString(),
  };
}

function mergeEmergencyList(list, incomingEmergency) {
  if (!incomingEmergency?.emergencyId) {
    return list;
  }

  let found = false;
  const merged = list.map((existing) => {
    if (existing.emergencyId !== incomingEmergency.emergencyId) {
      return existing;
    }

    found = true;
    return {
      ...existing,
      ...incomingEmergency,
      patientType: incomingEmergency.patientType || existing.patientType,
      emergencyType: incomingEmergency.emergencyType || existing.emergencyType,
      status: incomingEmergency.status || existing.status,
      ambulanceETA: incomingEmergency.ambulanceETA || existing.ambulanceETA,
      ambulanceLocation: incomingEmergency.ambulanceLocation || existing.ambulanceLocation,
      victimLocation: incomingEmergency.victimLocation || existing.victimLocation,
      hospitalLocation: incomingEmergency.hospitalLocation || existing.hospitalLocation,
      route: pickRoute(incomingEmergency.route, existing.route),
      routeToHospital: pickRoute(incomingEmergency.routeToHospital, existing.routeToHospital),
      hospitalReady: incomingEmergency.hospitalReady || existing.hospitalReady,
      ambulance: incomingEmergency.ambulance
        ? { ...(existing.ambulance || {}), ...incomingEmergency.ambulance }
        : existing.ambulance,
      receivedAt: existing.receivedAt || incomingEmergency.receivedAt,
      createdAt: existing.createdAt || incomingEmergency.createdAt,
    };
  });

  if (!found) {
    merged.unshift(incomingEmergency);
  }

  return merged
    .filter((item) => isActiveEmergency(item.status))
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
}

function mergeAmbulanceList(list, incomingAmbulance) {
  if (!incomingAmbulance?._id) {
    return list;
  }

  let found = false;
  const nextList = list.map((existing) => {
    if (existing._id !== incomingAmbulance._id) {
      return existing;
    }

    found = true;
    return {
      ...existing,
      ...incomingAmbulance,
      location: incomingAmbulance.location || existing.location,
      currentEmergency: incomingAmbulance.currentEmergency || existing.currentEmergency || null,
    };
  });

  if (!found) {
    nextList.push(incomingAmbulance);
  }

  return nextList;
}

function CommandCenterMap({ hospitals, ambulances, selectedHospitalId, onHospitalSelect }) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const hospitalLayerRef = useRef(null);
  const ambulanceLayerRef = useRef(null);
  const hospitalMarkersRef = useRef({});
  const fitBoundsRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    let intervalId = null;

    const initializeMap = () => {
      if (mapRef.current || !mapElementRef.current) {
        return;
      }

      if (!window.L) {
        setMapError('Leaflet failed to load. Check the dashboard page CDN includes.');
        return;
      }

      const map = window.L.map(mapElementRef.current, {
        zoomControl: true,
        preferCanvas: true,
      }).setView([CENTRAL_MUMBAI.lat, CENTRAL_MUMBAI.lng], 11);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      hospitalLayerRef.current = window.L.layerGroup().addTo(map);
      ambulanceLayerRef.current = window.L.layerGroup().addTo(map);
      mapRef.current = map;
      setMapReady(true);

      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };

    if (window.L) {
      initializeMap();
    } else {
      intervalId = window.setInterval(() => {
        if (window.L) {
          window.clearInterval(intervalId);
          initializeMap();
        }
      }, 300);
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        hospitalLayerRef.current = null;
        ambulanceLayerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !window.L || !hospitalLayerRef.current || !ambulanceLayerRef.current) {
      return;
    }

    hospitalLayerRef.current.clearLayers();
    ambulanceLayerRef.current.clearLayers();
    hospitalMarkersRef.current = {};

    const points = [];

    hospitals.forEach((hospital) => {
      if (!hospital?.location || !Number.isFinite(hospital.location.lat) || !Number.isFinite(hospital.location.lng)) {
        return;
      }

      const marker = window.L.marker([hospital.location.lat, hospital.location.lng], {
        icon: window.L.divIcon({
          className: '',
          html: `
            <div style="
              width: 34px;
              height: 34px;
              border-radius: 50%;
              background: ${c.primary};
              border: 2px solid #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 6px 18px rgba(0,0,0,0.18);
              font-size: 18px;
            ">🏥</div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
      });

      marker.bindPopup(
        `<div style="min-width: 180px; font-family: Arial, sans-serif;">
          <div style="font-weight: 700; color: ${c.text}; margin-bottom: 6px;">${escapeHtml(hospital.name)}</div>
          <div style="font-size: 12px; color: ${c.gray}; margin-bottom: 6px;">${escapeHtml(hospital.address || 'Address unavailable')}</div>
          <div style="font-size: 12px; color: ${getBedColor(hospital.availableBeds)}; font-weight: 700;">${toNumber(hospital.availableBeds)} beds available</div>
        </div>`
      );
      marker.on('click', () => onHospitalSelect(hospital._id));
      marker.addTo(hospitalLayerRef.current);
      hospitalMarkersRef.current[hospital._id] = marker;
      points.push([hospital.location.lat, hospital.location.lng]);
    });

    ambulances.forEach((ambulance) => {
      if (!ambulance?.location || !Number.isFinite(ambulance.location.lat) || !Number.isFinite(ambulance.location.lng)) {
        return;
      }

      const ambulanceColor = getAmbulanceColor(ambulance.status);
      const marker = window.L.marker([ambulance.location.lat, ambulance.location.lng], {
        icon: window.L.divIcon({
          className: '',
          html: `
            <div style="
              width: 34px;
              height: 34px;
              border-radius: 50%;
              background: ${ambulanceColor};
              border: 2px solid #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 6px 18px rgba(0,0,0,0.18);
              font-size: 18px;
            ">🚑</div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
      });

      marker.bindPopup(
        `<div style="min-width: 170px; font-family: Arial, sans-serif;">
          <div style="font-weight: 700; color: ${c.text}; margin-bottom: 6px;">${escapeHtml(ambulance.vehicle || 'Ambulance')}</div>
          <div style="font-size: 12px; color: ${c.gray}; margin-bottom: 6px;">Driver: ${escapeHtml(ambulance.driverName || 'Driver')}</div>
          <div style="font-size: 12px; color: ${ambulanceColor}; font-weight: 700; text-transform: capitalize;">${escapeHtml(ambulance.status || 'available')}</div>
        </div>`
      );

      marker.addTo(ambulanceLayerRef.current);
      points.push([ambulance.location.lat, ambulance.location.lng]);
    });

    if (points.length && mapRef.current && !fitBoundsRef.current) {
      mapRef.current.fitBounds(points, { padding: [28, 28] });
      fitBoundsRef.current = true;
    }
  }, [ambulances, hospitals, mapReady, onHospitalSelect]);

  useEffect(() => {
    if (!selectedHospitalId || !mapRef.current || !hospitalMarkersRef.current[selectedHospitalId]) {
      return;
    }

    const marker = hospitalMarkersRef.current[selectedHospitalId];
    const latLng = marker.getLatLng();
    mapRef.current.flyTo(latLng, Math.max(mapRef.current.getZoom(), 12), { duration: 0.6 });
    marker.openPopup();
  }, [selectedHospitalId]);

  return (
    <div style={{ position: 'relative', height: 420, width: '100%', background: '#E9EEF5' }}>
      <div ref={mapElementRef} style={{ height: '100%', width: '100%' }} />
      {!mapReady && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.72)',
          color: c.gray,
          fontSize: 14,
          fontWeight: 600,
        }}>
          {mapError || 'Loading live command map...'}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [hospitals, setHospitals] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [readyMap, setReadyMap] = useState({});
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);
  const [bedDraft, setBedDraft] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingBeds, setSavingBeds] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1440);
  const refreshIntervalRef = useRef(null);

  const loadHospitals = async () => {
    const response = await api.get('/api/hospital');
    const list = Array.isArray(response.data) ? response.data : [];
    setHospitals(list);
    return list;
  };

  const loadActiveEmergenciesFromAmbulances = async (ambulanceList) => {
    const emergencyIds = Array.from(
      new Set(
        ambulanceList
          .map((ambulance) => (typeof ambulance.currentEmergency === 'object' ? ambulance.currentEmergency?._id : ambulance.currentEmergency))
          .filter(Boolean)
      )
    );

    if (!emergencyIds.length) {
      setEmergencies([]);
      return [];
    }

    const responses = await Promise.allSettled(
      emergencyIds.map((emergencyId) => api.get(`/api/dispatch/${emergencyId}`))
    );

    const nextEmergencies = responses
      .filter((result) => result.status === 'fulfilled' && result.value?.data)
      .map((result) => normalizeEmergency(result.value.data))
      .filter((item) => item && isActiveEmergency(item.status))
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    setEmergencies(nextEmergencies);
    return nextEmergencies;
  };

  const loadAmbulances = async () => {
    const response = await api.get('/api/ambulance');
    const list = Array.isArray(response.data) ? response.data : [];
    setAmbulances(list);
    return list;
  };

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const ensureLogin = async () => {
      let token = localStorage.getItem('hospitalToken');
      let user = null;

      try {
        const storedUser = localStorage.getItem('hospitalUser');
        user = storedUser ? JSON.parse(storedUser) : null;
      } catch (parseError) {
        user = null;
      }

      if (!token) {
        const response = await api.post('/api/auth/login', {
          email: 'hospital@test.com',
          password: '123456',
        });
        token = response.data.token;
        user = response.data.user;
        localStorage.setItem('hospitalToken', token);
        localStorage.setItem('hospitalUser', JSON.stringify(user));
      }

      return user;
    };

    const initialize = async () => {
      try {
        setLoading(true);
        setError('');

        const user = await ensureLogin();
        if (cancelled) {
          return;
        }

        setLoggedInUser(user || null);

        const [hospitalList, ambulanceList] = await Promise.all([loadHospitals(), loadAmbulances()]);
        if (cancelled) {
          return;
        }

        if (!selectedHospitalId && hospitalList.length) {
          setSelectedHospitalId(hospitalList[0]._id);
        }

        await loadActiveEmergenciesFromAmbulances(ambulanceList);

        refreshIntervalRef.current = window.setInterval(() => {
          loadHospitals().catch((refreshError) => {
            console.error('Hospital refresh error:', refreshError.message);
          });
        }, 30000);
      } catch (initError) {
        if (!cancelled) {
          setError(initError.response?.data?.message || initError.message || 'Failed to load command center');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
      if (refreshIntervalRef.current) {
        window.clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hospitals.length) {
      setSelectedHospitalId(null);
      return;
    }

    const stillExists = hospitals.some((hospital) => hospital._id === selectedHospitalId);
    if (!selectedHospitalId || !stillExists) {
      setSelectedHospitalId(hospitals[0]._id);
    }
  }, [hospitals, selectedHospitalId]);

  useEffect(() => {
    const selectedHospital = hospitals.find((hospital) => hospital._id === selectedHospitalId);
    if (selectedHospital) {
      setBedDraft(String(toNumber(selectedHospital.availableBeds)));
    }
  }, [hospitals, selectedHospitalId]);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      setConnected(true);
      socket.emit('register', {
        userId: loggedInUser?._id || 'central-command-center',
        role: 'hospital',
      });
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleHospitalAlert = (payload) => {
      const incomingEmergency = normalizeEmergency({
        ...payload,
        status: payload.status || 'dispatched',
        receivedAt: payload.receivedAt || new Date().toISOString(),
      });

      setEmergencies((previous) => mergeEmergencyList(previous, incomingEmergency));
    };

    const handlePatientArrived = (payload) => {
      const incomingEmergency = normalizeEmergency({
        ...payload,
        status: payload.status || 'arriving',
      });

      setEmergencies((previous) => mergeEmergencyList(previous, incomingEmergency));
    };

    const handleAmbulanceLocation = (payload) => {
      const incomingEmergency = normalizeEmergency({
        ...payload,
        ambulanceLocation: payload.ambulanceLocation || (
          Number.isFinite(payload.lat) && Number.isFinite(payload.lng)
            ? { lat: payload.lat, lng: payload.lng }
            : null
        ),
      });

      setEmergencies((previous) => mergeEmergencyList(previous, incomingEmergency));

      const ambulanceId = payload.ambulance?.id || payload.ambulance?._id || incomingEmergency?.ambulance?._id;
      if (ambulanceId) {
        setAmbulances((previous) =>
          mergeAmbulanceList(previous, {
            _id: ambulanceId,
            vehicle: payload.ambulance?.vehicle || incomingEmergency?.ambulance?.vehicle || 'Ambulance',
            type: payload.ambulance?.type || incomingEmergency?.ambulance?.type || 'BLS',
            driverName: payload.ambulance?.driverName || incomingEmergency?.ambulance?.driverName || 'Driver',
            status: getAmbulanceStatusFromEmergency(payload.status || incomingEmergency?.status),
            location: Number.isFinite(payload.lat) && Number.isFinite(payload.lng)
              ? { lat: payload.lat, lng: payload.lng }
              : incomingEmergency?.ambulanceLocation,
            currentEmergency: payload.emergencyId || incomingEmergency?.emergencyId || null,
          })
        );
      }
    };

    if (socket.connected) {
      handleConnect();
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('hospital-alert', handleHospitalAlert);
    socket.on('patient-arrived', handlePatientArrived);
    socket.on('hospital-ambulance-location', handleAmbulanceLocation);
    socket.on('ambulance-location', handleAmbulanceLocation);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('hospital-alert', handleHospitalAlert);
      socket.off('patient-arrived', handlePatientArrived);
      socket.off('hospital-ambulance-location', handleAmbulanceLocation);
      socket.off('ambulance-location', handleAmbulanceLocation);
    };
  }, [loggedInUser]);

  const activeEmergencies = emergencies.filter((emergency) => isActiveEmergency(emergency.status));
  const totalAvailableBeds = hospitals.reduce((sum, hospital) => sum + toNumber(hospital.availableBeds), 0);
  const ambulancesEnRoute = ambulances.filter((ambulance) => ['dispatched', 'busy'].includes(ambulance.status)).length;
  const averageResponseTime = activeEmergencies.length
    ? (activeEmergencies.reduce((sum, emergency) => sum + toNumber(emergency.ambulanceETA), 0) / activeEmergencies.length)
    : 0;
  const dispatchedTodayCount = Array.from(
    new Set(
      activeEmergencies
        .filter((emergency) => isToday(emergency.receivedAt))
        .map((emergency) => emergency.ambulance?._id || emergency.emergencyId)
        .filter(Boolean)
    )
  ).length;

  const selectedHospital = hospitals.find((hospital) => hospital._id === selectedHospitalId) || null;
  const selectedHospitalEmergencies = activeEmergencies.filter((emergency) => emergency.hospitalId === selectedHospitalId);
  const isMobile = viewportWidth < 860;
  const isTablet = viewportWidth < 1280;

  const statItems = [
    {
      label: 'Total Active Emergencies',
      value: activeEmergencies.length,
      accent: c.emergency,
      emoji: '🚨',
    },
    {
      label: 'Total Available Beds',
      value: totalAvailableBeds,
      accent: c.safe,
      emoji: '🛏️',
    },
    {
      label: 'Total Ambulances En Route',
      value: ambulancesEnRoute,
      accent: c.warning,
      emoji: '🚑',
    },
    {
      label: 'Average Response Time',
      value: `${averageResponseTime ? averageResponseTime.toFixed(1) : '0.0'} min`,
      accent: c.primary,
      emoji: '⏱️',
    },
  ];

  const handleMarkReady = (emergencyId) => {
    const socket = getSocket();
    socket.emit('hospital-ready', { emergencyId });
    setReadyMap((previous) => ({ ...previous, [emergencyId]: true }));
    setEmergencies((previous) =>
      previous.map((emergency) =>
        emergency.emergencyId === emergencyId
          ? { ...emergency, hospitalReady: true }
          : emergency
      )
    );
  };

  const handleSaveBeds = async () => {
    if (!selectedHospitalId) {
      return;
    }

    try {
      setSavingBeds(true);
      const response = await api.put('/api/hospital/beds', {
        hospitalId: selectedHospitalId,
        availableBeds: Math.max(0, toNumber(bedDraft)),
      });

      setHospitals((previous) =>
        previous.map((hospital) =>
          hospital._id === response.data._id ? response.data : hospital
        )
      );
    } catch (saveError) {
      setError(saveError.response?.data?.message || saveError.message || 'Unable to update beds');
    } finally {
      setSavingBeds(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: c.bg, color: c.text, fontFamily: 'inherit' }}>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: c.card,
        borderBottom: `1px solid ${c.border}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div style={{
          maxWidth: 1600,
          margin: '0 auto',
          padding: isMobile ? '18px 16px' : '18px 24px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 26 }}>🚑</span>
              <span style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, letterSpacing: -0.6 }}>
                RapidAid — Central Command Center
              </span>
              <span style={{
                padding: '4px 10px',
                borderRadius: 999,
                border: `1px solid ${connected ? c.safe : c.border}`,
                background: connected ? `${c.safe}15` : `${c.gray}12`,
                color: connected ? c.safe : c.gray,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 0.8,
              }}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Total Hospitals', value: hospitals.length },
                { label: 'Active Emergencies', value: activeEmergencies.length },
                { label: 'Ambulances Dispatched Today', value: dispatchedTodayCount },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: c.bg,
                    border: `1px solid ${c.border}`,
                    borderRadius: 14,
                    padding: '10px 14px',
                    minWidth: 170,
                  }}
                >
                  <div style={{ fontSize: 11, color: c.gray, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
            <div style={{ fontSize: 12, color: c.gray, marginBottom: 6 }}>Real-time operations view</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {loggedInUser?.email || 'hospital@test.com'}
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1600, margin: '0 auto', padding: isMobile ? 16 : 24 }}>
        {error && (
          <div style={{
            marginBottom: 18,
            padding: '12px 16px',
            borderRadius: 14,
            background: `${c.emergency}12`,
            border: `1px solid ${c.emergency}30`,
            color: c.emergency,
            fontSize: 14,
            fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        <section style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}>
          {statItems.map((item) => (
            <div
              key={item.label}
              style={{
                background: c.card,
                border: `1px solid ${c.border}`,
                borderRadius: 18,
                padding: '18px 18px 16px',
                boxShadow: '0 4px 16px rgba(28,28,30,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  background: `${item.accent}16`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}>
                  {item.emoji}
                </div>
                <div style={{ fontSize: 11, color: c.gray, textTransform: 'uppercase', letterSpacing: 0.7 }}>
                  Live
                </div>
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: item.accent, marginBottom: 4 }}>{item.value}</div>
              <div style={{ fontSize: 13, color: c.gray }}>{item.label}</div>
            </div>
          ))}
        </section>

        <section style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'minmax(0,1fr)' : 'minmax(0,1.08fr) minmax(0,1fr) 340px',
          gap: 20,
          alignItems: 'start',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{
              background: c.card,
              border: `1px solid ${c.border}`,
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(28,28,30,0.04)',
            }}>
              <div style={{
                padding: '16px 18px',
                borderBottom: `1px solid ${c.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>All Hospitals</div>
                  <div style={{ fontSize: 13, color: c.gray, marginTop: 4 }}>
                    System-wide hospital availability and specialist coverage
                  </div>
                </div>
                <div style={{ fontSize: 12, color: c.gray }}>
                  Distance reference: Central Mumbai ({CENTRAL_MUMBAI.lat}, {CENTRAL_MUMBAI.lng})
                </div>
              </div>

              <div style={{ padding: 18 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: 16,
                }}>
                  {hospitals.map((hospital) => {
                    const assignedEmergencies = activeEmergencies.filter((emergency) => emergency.hospitalId === hospital._id);
                    const bedColor = getBedColor(toNumber(hospital.availableBeds));
                    const distanceKm = haversineKm(
                      CENTRAL_MUMBAI.lat,
                      CENTRAL_MUMBAI.lng,
                      toNumber(hospital.location?.lat),
                      toNumber(hospital.location?.lng)
                    );
                    const isSelected = hospital._id === selectedHospitalId;

                    return (
                      <button
                        key={hospital._id}
                        onClick={() => setSelectedHospitalId(hospital._id)}
                        style={{
                          textAlign: 'left',
                          background: isSelected ? `${c.primary}08` : c.card,
                          border: `1px solid ${isSelected ? c.primary : c.border}`,
                          borderRadius: 18,
                          padding: 16,
                          cursor: 'pointer',
                          boxShadow: isSelected ? '0 8px 24px rgba(0,122,255,0.08)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{hospital.name}</div>
                            <div style={{ fontSize: 13, color: c.gray, lineHeight: 1.5 }}>{hospital.address}</div>
                          </div>
                          <div style={{
                            padding: '6px 10px',
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 800,
                            background: assignedEmergencies.length ? `${c.warning}18` : `${c.safe}16`,
                            color: assignedEmergencies.length ? c.warning : c.safe,
                            whiteSpace: 'nowrap',
                          }}>
                            {assignedEmergencies.length ? 'Busy' : 'Available'}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                          <div style={{
                            padding: '10px 12px',
                            borderRadius: 14,
                            background: `${bedColor}12`,
                            color: bedColor,
                            fontSize: 13,
                            fontWeight: 800,
                          }}>
                            {toNumber(hospital.availableBeds)} beds available
                          </div>
                          <div style={{
                            padding: '10px 12px',
                            borderRadius: 14,
                            background: `${c.primary}10`,
                            color: c.primary,
                            fontSize: 13,
                            fontWeight: 700,
                          }}>
                            {distanceKm.toFixed(1)} km from central Mumbai
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {(hospital.specialists || []).map((specialist) => (
                            <span
                              key={`${hospital._id}-${specialist}`}
                              style={{
                                padding: '5px 9px',
                                borderRadius: 999,
                                background: c.bg,
                                border: `1px solid ${c.border}`,
                                fontSize: 11,
                                fontWeight: 700,
                                color: c.text,
                                textTransform: 'capitalize',
                              }}
                            >
                              {specialist}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}

                  {!loading && hospitals.length === 0 && (
                    <div style={{ padding: 22, color: c.gray, fontSize: 14 }}>
                      No hospitals available.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{
              background: c.card,
              border: `1px solid ${c.border}`,
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(28,28,30,0.04)',
            }}>
              <div style={{
                padding: '16px 18px',
                borderBottom: `1px solid ${c.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>Active Emergencies</div>
                  <div style={{ fontSize: 13, color: c.gray, marginTop: 4 }}>
                    Real-time alerts across every hospital in the network
                  </div>
                </div>
                <div style={{ fontSize: 12, color: c.gray }}>{activeEmergencies.length} active</div>
              </div>

              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {activeEmergencies.length === 0 ? (
                  <div style={{ padding: 36, textAlign: 'center', color: c.gray }}>
                    <div style={{ fontSize: 34, marginBottom: 10 }}>📡</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: c.text, marginBottom: 6 }}>No active emergencies</div>
                    <div style={{ fontSize: 13 }}>Incoming alerts from all hospitals will appear here.</div>
                  </div>
                ) : (
                  activeEmergencies.map((emergency) => {
                    const emergencyMeta = getEmergencyMeta(emergency.patientType);
                    const statusMeta = getEmergencyStatusMeta(emergency.status);
                    const isReady = readyMap[emergency.emergencyId] || emergency.hospitalReady;

                    return (
                      <div
                        key={emergency.emergencyId}
                        style={{
                          padding: 16,
                          borderBottom: `1px solid ${c.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                        }}
                      >
                        <div style={{
                          width: 52,
                          height: 52,
                          borderRadius: 16,
                          background: `${emergencyMeta.color}12`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 24,
                          flexShrink: 0,
                        }}>
                          {emergencyMeta.emoji}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: c.text }}>
                              {emergency.patientType} Emergency
                            </div>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: 999,
                              background: statusMeta.bg,
                              color: statusMeta.color,
                              fontSize: 11,
                              fontWeight: 800,
                            }}>
                              {statusMeta.label}
                            </span>
                          </div>

                          <div style={{ fontSize: 13, color: c.gray, marginBottom: 6, lineHeight: 1.55 }}>
                            Going to <span style={{ color: c.text, fontWeight: 700 }}>{emergency.hospitalName}</span>
                            {' '}• ETA <span style={{ color: c.text, fontWeight: 700 }}>{toNumber(emergency.ambulanceETA)} min</span>
                            {' '}• ID <span style={{ color: c.primary, fontFamily: 'monospace', fontWeight: 700 }}>{String(emergency.emergencyId || '').slice(-8).toUpperCase()}</span>
                          </div>

                          <div style={{ fontSize: 12, color: c.gray }}>
                            Received {emergency.receivedAt ? new Date(emergency.receivedAt).toLocaleTimeString() : '—'}
                          </div>
                        </div>

                        <button
                          onClick={() => handleMarkReady(emergency.emergencyId)}
                          disabled={isReady}
                          style={{
                            border: `1px solid ${isReady ? c.safe : c.primary}`,
                            background: isReady ? `${c.safe}12` : c.primary,
                            color: isReady ? c.safe : '#FFFFFF',
                            borderRadius: 12,
                            padding: '10px 14px',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: isReady ? 'default' : 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isReady ? 'Ready' : 'Mark Ready'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{
              background: c.card,
              border: `1px solid ${c.border}`,
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(28,28,30,0.04)',
            }}>
              <div style={{
                padding: '16px 18px',
                borderBottom: `1px solid ${c.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>Live Map</div>
                  <div style={{ fontSize: 13, color: c.gray, marginTop: 4 }}>
                    All hospitals and active ambulance units with live location updates
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {[
                    { label: 'Available', color: c.safe },
                    { label: 'Dispatched', color: c.warning },
                    { label: 'Busy', color: c.emergency },
                  ].map((legend) => (
                    <div key={legend.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: c.gray }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: legend.color, display: 'inline-block' }} />
                      {legend.label}
                    </div>
                  ))}
                </div>
              </div>
              <CommandCenterMap
                hospitals={hospitals}
                ambulances={ambulances.filter((ambulance) => ambulance.location)}
                selectedHospitalId={selectedHospitalId}
                onHospitalSelect={setSelectedHospitalId}
              />
            </div>
          </div>

          <aside style={{
            background: c.card,
            border: `1px solid ${c.border}`,
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(28,28,30,0.04)',
            position: isMobile || isTablet ? 'static' : 'sticky',
            top: isMobile || isTablet ? 'auto' : 108,
          }}>
            <div style={{
              padding: '16px 18px',
              borderBottom: `1px solid ${c.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Hospital Details</div>
                <div style={{ fontSize: 13, color: c.gray, marginTop: 4 }}>
                  Click a hospital card or marker to inspect and update capacity
                </div>
              </div>
            </div>

            {!selectedHospital ? (
              <div style={{ padding: 22, color: c.gray, fontSize: 14 }}>Select a hospital to open the sidebar.</div>
            ) : (
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>{selectedHospital.name}</div>
                  <div style={{ fontSize: 13, color: c.gray, lineHeight: 1.6 }}>{selectedHospital.address}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  <div style={{ padding: 12, borderRadius: 14, background: c.bg, border: `1px solid ${c.border}` }}>
                    <div style={{ fontSize: 11, color: c.gray, textTransform: 'uppercase', letterSpacing: 0.8 }}>Phone</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{selectedHospital.phone || 'Unavailable'}</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 14, background: c.bg, border: `1px solid ${c.border}` }}>
                    <div style={{ fontSize: 11, color: c.gray, textTransform: 'uppercase', letterSpacing: 0.8 }}>Beds</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{toNumber(selectedHospital.availableBeds)} available</div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: c.gray, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                    Specialists
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(selectedHospital.specialists || []).map((specialist, index) => (
                      <span
                        key={`${selectedHospital._id}-${specialist}-${index}`}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 999,
                          background: index % 3 === 0 ? `${c.primary}12` : index % 3 === 1 ? `${c.safe}12` : `${c.warning}12`,
                          color: index % 3 === 0 ? c.primary : index % 3 === 1 ? c.safe : c.warning,
                          fontSize: 12,
                          fontWeight: 800,
                          textTransform: 'capitalize',
                        }}
                      >
                        {specialist}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: c.gray, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                    Active Emergencies Assigned
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {selectedHospitalEmergencies.length === 0 ? (
                      <div style={{
                        padding: 12,
                        borderRadius: 14,
                        background: `${c.safe}10`,
                        border: `1px solid ${c.safe}20`,
                        color: c.safe,
                        fontSize: 13,
                        fontWeight: 700,
                      }}>
                        No active emergencies assigned.
                      </div>
                    ) : (
                      selectedHospitalEmergencies.map((emergency) => {
                        const statusMeta = getEmergencyStatusMeta(emergency.status);
                        return (
                          <div
                            key={`sidebar-${emergency.emergencyId}`}
                            style={{
                              padding: 12,
                              borderRadius: 14,
                              background: c.bg,
                              border: `1px solid ${c.border}`,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                              <div style={{ fontSize: 13, fontWeight: 800 }}>{emergency.patientType} Emergency</div>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: 999,
                                background: statusMeta.bg,
                                color: statusMeta.color,
                                fontSize: 10,
                                fontWeight: 800,
                              }}>
                                {statusMeta.label}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: c.gray, lineHeight: 1.5 }}>
                              ETA {toNumber(emergency.ambulanceETA)} min • {String(emergency.emergencyId || '').slice(-8).toUpperCase()}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: c.gray, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                    Update Beds
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      type="number"
                      min="0"
                      value={bedDraft}
                      onChange={(event) => setBedDraft(event.target.value)}
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 12,
                        border: `1px solid ${c.border}`,
                        padding: '0 12px',
                        outline: 'none',
                        fontSize: 14,
                        color: c.text,
                        background: '#FFFFFF',
                      }}
                    />
                    <button
                      onClick={handleSaveBeds}
                      disabled={savingBeds}
                      style={{
                        border: 'none',
                        borderRadius: 12,
                        background: c.primary,
                        color: '#FFFFFF',
                        padding: '0 16px',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: savingBeds ? 'default' : 'pointer',
                        opacity: savingBeds ? 0.7 : 1,
                      }}
                    >
                      {savingBeds ? 'Saving...' : 'Update Beds'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}

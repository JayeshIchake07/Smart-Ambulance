import React, { useEffect, useRef, useState } from 'react';

const panelStyles = {
  shell: {
    position: 'relative',
    width: '100%',
    height: 540,
    borderRadius: 22,
    overflow: 'hidden',
    background: 'linear-gradient(180deg, #f6fbff 0%, #eaf2f8 100%)',
    boxShadow: '0 18px 40px rgba(21, 35, 52, 0.12)',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 500,
    width: 'min(340px, calc(100% - 32px))',
    padding: 16,
    borderRadius: 20,
    background: 'rgba(255,255,255,0.96)',
    border: '1px solid rgba(16, 24, 40, 0.08)',
    boxShadow: '0 16px 30px rgba(15, 23, 42, 0.14)',
    backdropFilter: 'blur(14px)',
  },
  hiddenHint: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 500,
    padding: '10px 14px',
    borderRadius: 999,
    background: 'rgba(19,34,56,0.86)',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 700,
    boxShadow: '0 12px 24px rgba(15, 23, 42, 0.2)',
  },
  eyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#0c8a58',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  titleActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.1,
    color: '#132238',
  },
  status: {
    padding: '8px 12px',
    borderRadius: 999,
    background: 'rgba(17,163,106,0.12)',
    color: '#0c8a58',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  closeButton: {
    width: 34,
    height: 34,
    border: 'none',
    borderRadius: 999,
    background: 'rgba(19, 34, 56, 0.08)',
    color: '#132238',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
    marginTop: 16,
  },
  card: {
    padding: 14,
    borderRadius: 16,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(233,243,249,0.96))',
    border: '1px solid rgba(16,24,40,0.06)',
  },
  label: {
    display: 'block',
    marginBottom: 6,
    color: '#607086',
    fontSize: 12,
  },
  cardValue: {
    color: '#132238',
    fontSize: 17,
    fontWeight: 700,
  },
  subtext: {
    marginTop: 12,
    color: '#607086',
    fontSize: 12,
    lineHeight: 1.4,
  },
  instructionsWrap: {
    marginTop: 16,
  },
  instructionsTitle: {
    margin: 0,
    color: '#132238',
    fontSize: 15,
    fontWeight: 700,
  },
  instructions: {
    margin: '10px 0 0',
    paddingLeft: 20,
    maxHeight: 190,
    overflowY: 'auto',
    color: '#607086',
    fontSize: 13,
    lineHeight: 1.4,
  },
  instructionItem: {
    padding: '8px 0',
    borderTop: '1px solid rgba(16,24,40,0.06)',
  },
  empty: {
    display: 'grid',
    placeItems: 'center',
    height: '100%',
    color: '#607086',
    fontSize: 14,
  },
};

function formatDistance(distanceInMeters) {
  if (!distanceInMeters && distanceInMeters !== 0) {
    return 'Calculating...';
  }

  if (distanceInMeters >= 1000) {
    return `${(distanceInMeters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(distanceInMeters)} m`;
}

function formatDuration(durationInSeconds) {
  if (!durationInSeconds && durationInSeconds !== 0) {
    return 'Calculating...';
  }

  const totalMinutes = Math.max(1, Math.round(durationInSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) {
    return `${totalMinutes} min`;
  }

  return `${hours} hr ${minutes} min`;
}

function calculateBearing(from, to) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function getStatusLabel(emergency, destinationLabel) {
  if (!emergency) {
    return 'Waiting';
  }

  if (emergency.status === 'patient_picked_up' || emergency.status === 'arriving') {
    return `To ${destinationLabel}`;
  }

  return 'Dispatch active';
}

function createAmbulanceIcon() {
  return window.L.divIcon({
    className: 'hospital-ambulance-marker',
    html: `
      <div style="width:56px;height:56px;display:grid;place-items:center;filter:drop-shadow(0 10px 20px rgba(12,138,88,0.28));">
        <div class="ambulance-rotator" style="--heading:0deg;width:56px;height:56px;display:grid;place-items:center;border-radius:18px;background:linear-gradient(180deg,#ffffff 0%,#edf6f2 100%);border:2px solid rgba(17,163,106,0.28);transition:transform 0.16s linear;transform:rotate(var(--heading));">
          <svg viewBox="0 0 64 64" aria-hidden="true" style="width:32px;height:32px;">
            <rect x="8" y="24" width="30" height="18" rx="6" fill="#12b76a"></rect>
            <path d="M38 28h10l8 9v5H38z" fill="#0c8a58"></path>
            <rect x="14" y="28" width="8" height="8" fill="#ffffff"></rect>
            <rect x="17" y="25" width="2" height="14" fill="#ffffff"></rect>
            <rect x="11" y="31" width="14" height="2" fill="#ffffff"></rect>
            <circle cx="20" cy="45" r="5" fill="#132238"></circle>
            <circle cx="47" cy="45" r="5" fill="#132238"></circle>
            <rect x="42" y="30" width="8" height="5" rx="2" fill="#b7f7d8"></rect>
          </svg>
        </div>
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  });
}

function createDestinationIcon(label) {
  return window.L.divIcon({
    className: 'hospital-destination-marker',
    html: `
      <div style="min-width:18px;height:18px;border-radius:50%;background:#1d4ed8;border:4px solid #ffffff;box-shadow:0 8px 18px rgba(29,78,216,0.28);"></div>
      <div style="margin-top:8px;padding:6px 10px;border-radius:999px;background:rgba(19,34,56,0.92);color:#fff;font-size:11px;font-weight:700;white-space:nowrap;">${label}</div>
    `,
    iconSize: [90, 42],
    iconAnchor: [9, 9],
  });
}

export default function HospitalNavigationMap({ emergency, hospitalLocation, hospitalName }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routingControlRef = useRef(null);
  const ambulanceMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const animationStateRef = useRef(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [routeInfo, setRouteInfo] = useState({
    distance: 'Waiting for live route',
    eta: 'Waiting for live route',
    instructions: ['Select an active ambulance to start navigation.'],
  });

  const currentPosition = emergency?.ambulanceLocation;
  const destination = emergency?.status === 'patient_picked_up' || emergency?.status === 'arriving'
    ? hospitalLocation
    : emergency?.victimLocation || hospitalLocation;
  const destinationLabel = emergency?.status === 'patient_picked_up' || emergency?.status === 'arriving'
    ? hospitalName || 'Hospital'
    : 'Patient';

  useEffect(() => {
    setOverlayVisible(true);
  }, [emergency?.emergencyId, emergency?.status]);

  useEffect(() => {
    const L = window.L;
    if (!mapRef.current || mapInstanceRef.current || !L || !L.Routing) {
      return undefined;
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
      preferCanvas: true,
    }).setView(hospitalLocation ? [hospitalLocation.lat, hospitalLocation.lng] : [19.076, 72.8777], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    routingControlRef.current = L.Routing.control({
      waypoints: [],
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: false,
      showAlternatives: false,
      createMarker: () => null,
      lineOptions: {
        styles: [
          { color: '#34d399', opacity: 0.2, weight: 16 },
          { color: '#0fbf78', opacity: 0.96, weight: 8 },
          { color: '#ffffff', opacity: 0.82, weight: 2 },
        ],
        extendToWaypoints: true,
        missingRouteTolerance: 0,
      },
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
      }),
    }).addTo(map);

    routingControlRef.current.on('routesfound', (event) => {
      const route = event.routes[0];
      if (!route) {
        return;
      }

      setRouteInfo({
        distance: formatDistance(route.summary.totalDistance),
        eta: formatDuration(route.summary.totalTime),
        instructions: route.instructions?.length
          ? route.instructions.map((instruction) => `${instruction.text} (${formatDistance(instruction.distance)})`)
          : ['Continue on the highlighted route.'],
      });
    });

    routingControlRef.current.on('routingerror', () => {
      setRouteInfo({
        distance: 'Route unavailable',
        eta: emergency?.ambulanceETA ? `${emergency.ambulanceETA} min` : 'Unavailable',
        instructions: ['The routing service is temporarily unavailable.'],
      });
    });

    mapInstanceRef.current = map;

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      map.remove();
      mapInstanceRef.current = null;
      routingControlRef.current = null;
      ambulanceMarkerRef.current = null;
      destinationMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !hospitalLocation || currentPosition) {
      return;
    }

    map.setView([hospitalLocation.lat, hospitalLocation.lng], 13);
  }, [currentPosition, hospitalLocation]);

  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map || !hospitalLocation) {
      return;
    }

    if (!currentPosition || !destination) {
      setRouteInfo({
        distance: 'Waiting for ambulance',
        eta: emergency?.ambulanceETA ? `${emergency.ambulanceETA} min` : 'Pending',
        instructions: ['Live navigation will appear when the ambulance location is available.'],
      });
      return;
    }

    if (!ambulanceMarkerRef.current) {
      ambulanceMarkerRef.current = L.marker([currentPosition.lat, currentPosition.lng], {
        icon: createAmbulanceIcon(),
        zIndexOffset: 1000,
      }).addTo(map);
    }

    if (!destinationMarkerRef.current) {
      destinationMarkerRef.current = L.marker([destination.lat, destination.lng], {
        icon: createDestinationIcon(destinationLabel),
      }).addTo(map);
    } else {
      destinationMarkerRef.current.setLatLng([destination.lat, destination.lng]);
      destinationMarkerRef.current.setIcon(createDestinationIcon(destinationLabel));
    }

    updateRoute(currentPosition, destination);
    animateAmbulance(map, currentPosition);
  }, [currentPosition, destination, destinationLabel, emergency?.ambulanceETA, emergency?.status, hospitalLocation]);

  function updateRoute(start, end) {
    const L = window.L;
    if (!routingControlRef.current || !L) {
      return;
    }

    routingControlRef.current.setWaypoints([
      L.latLng(start.lat, start.lng),
      L.latLng(end.lat, end.lng),
    ]);
  }

  function animateAmbulance(map, nextPosition) {
    const marker = ambulanceMarkerRef.current;
    if (!marker) {
      return;
    }

    const start = marker.getLatLng();
    const target = window.L.latLng(nextPosition.lat, nextPosition.lng);
    const duration = 1800;
    const startedAt = performance.now();

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationStateRef.current = { start, target, startedAt, duration };
    updateHeading(start, target);

    const step = (now) => {
      const currentAnimation = animationStateRef.current;
      if (!currentAnimation) {
        return;
      }

      const progress = Math.min(1, (now - currentAnimation.startedAt) / currentAnimation.duration);
      const lat = currentAnimation.start.lat + (currentAnimation.target.lat - currentAnimation.start.lat) * progress;
      const lng = currentAnimation.start.lng + (currentAnimation.target.lng - currentAnimation.start.lng) * progress;
      const interpolated = window.L.latLng(lat, lng);

      marker.setLatLng(interpolated);
      map.panTo(interpolated, {
        animate: true,
        duration: 0.4,
        noMoveStart: true,
      });

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
        return;
      }

      animationFrameRef.current = null;
    };

    animationFrameRef.current = requestAnimationFrame(step);
  }

  function updateHeading(from, to) {
    const markerElement = ambulanceMarkerRef.current?.getElement();
    if (!markerElement) {
      return;
    }

    const rotator = markerElement.querySelector('.ambulance-rotator');
    if (!rotator) {
      return;
    }

    rotator.style.setProperty('--heading', `${calculateBearing(from, to)}deg`);
  }

  return (
    <div style={panelStyles.shell} onClick={() => setOverlayVisible(true)}>
      <div ref={mapRef} style={panelStyles.map} />

      {overlayVisible ? (
      <div style={panelStyles.overlay} onClick={(event) => event.stopPropagation()}>
        <p style={panelStyles.eyebrow}>Live Navigation</p>
        <div style={panelStyles.titleRow}>
          <div>
            <h2 style={panelStyles.title}>Ambulance Route</h2>
          </div>
          <div style={panelStyles.titleActions}>
            <span style={panelStyles.status}>{getStatusLabel(emergency, destinationLabel)}</span>
            <button
              type="button"
              style={panelStyles.closeButton}
              onClick={(event) => {
                event.stopPropagation();
                setOverlayVisible(false);
              }}
              aria-label="Hide live navigation"
            >
              ×
            </button>
          </div>
        </div>

        <div style={panelStyles.summaryGrid}>
          <div style={panelStyles.card}>
            <span style={panelStyles.label}>Distance</span>
            <strong style={panelStyles.cardValue}>{routeInfo.distance}</strong>
          </div>
          <div style={panelStyles.card}>
            <span style={panelStyles.label}>ETA</span>
            <strong style={panelStyles.cardValue}>{emergency?.ambulanceETA ? `${emergency.ambulanceETA} min` : routeInfo.eta}</strong>
          </div>
        </div>

        <p style={panelStyles.subtext}>
          Tracking {emergency?.ambulance?.vehicle || 'assigned ambulance'} toward {destinationLabel.toLowerCase()} with live map centering.
        </p>

        <div style={panelStyles.instructionsWrap}>
          <h3 style={panelStyles.instructionsTitle}>Turn-by-turn</h3>
          <ol style={panelStyles.instructions}>
            {routeInfo.instructions.map((instruction, index) => (
              <li key={`${instruction}-${index}`} style={panelStyles.instructionItem}>{instruction}</li>
            ))}
          </ol>
        </div>
      </div>
      ) : (
        <div style={panelStyles.hiddenHint}>Tap map to show navigation</div>
      )}

      {!emergency && <div style={panelStyles.empty}>Waiting for an active ambulance route.</div>}
    </div>
  );
}
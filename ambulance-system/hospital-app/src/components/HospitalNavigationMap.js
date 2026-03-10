import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { buildNavigationMapHtml } from 'rapidaid-navigation-template';

const styles = {
  shell: {
    position: 'relative',
    width: '100%',
    height: 540,
    borderRadius: 22,
    overflow: 'hidden',
    background: 'linear-gradient(180deg, #f6fbff 0%, #eaf2f8 100%)',
    boxShadow: '0 18px 40px rgba(21, 35, 52, 0.12)',
  },
  frame: {
    width: '100%',
    height: '100%',
    border: 0,
  },
  empty: {
    display: 'grid',
    placeItems: 'center',
    height: '100%',
    color: '#607086',
    fontSize: 14,
  },
};

function getPhaseLabel(emergency, destinationLabel) {
  if (!emergency) {
    return 'Waiting';
  }

  if (emergency.status === 'patient_picked_up' || emergency.status === 'arriving') {
    return `To ${destinationLabel}`;
  }

  return 'Dispatch active';
}

function buildSubtitle(emergency, destinationLabel) {
  if (!emergency) {
    return 'Waiting for an active ambulance route.';
  }

  const vehicle = emergency.ambulance?.vehicle || 'assigned ambulance';
  return `Tracking ${vehicle} toward ${destinationLabel.toLowerCase()} with live map centering.`;
}

export default function HospitalNavigationMap({ emergency, hospitalLocation, hospitalName }) {
  const iframeRef = useRef(null);
  const hasInitializedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  const currentPosition = emergency?.ambulanceLocation || hospitalLocation;
  const isToHospital = emergency?.status === 'patient_picked_up' || emergency?.status === 'arriving';
  const destination = isToHospital
    ? hospitalLocation
    : emergency?.victimLocation || hospitalLocation;
  const destinationLabel = isToHospital
    ? hospitalName || 'Hospital'
    : 'Patient';
  const phaseLabel = getPhaseLabel(emergency, destinationLabel);
  const panelSubtitle = buildSubtitle(emergency, destinationLabel);
  const routeCoordinates = useMemo(() => {
    if (!emergency) {
      return [];
    }

    const points = isToHospital ? emergency.routeToHospital : emergency.route;
    return Array.isArray(points) && points.length > 1 ? points : [];
  }, [emergency, isToHospital]);

  const mapHtml = useMemo(() => {
    if (!currentPosition || !destination) {
      return null;
    }

    return buildNavigationMapHtml({
      startLat: currentPosition.lat,
      startLng: currentPosition.lng,
      destinationLat: destination.lat,
      destinationLng: destination.lng,
      title: 'Ambulance Route',
      phaseLabel,
      destinationLabel,
      panelSubtitle,
      markerVariant: 'arrow',
      hintText: 'Tap map to show navigation',
      routeCoordinates,
    });
  }, [destination?.lat, destination?.lng, destinationLabel, panelSubtitle, phaseLabel, routeCoordinates]);

  useEffect(() => {
    if (!mapHtml) {
      return;
    }

    setMapReady(false);
    hasInitializedRef.current = false;
  }, [emergency?.emergencyId, mapHtml]);

  const postMessageToMap = useCallback((payload) => {
    if (!iframeRef.current?.contentWindow) {
      return;
    }

    iframeRef.current.contentWindow.postMessage(JSON.stringify(payload), '*');
  }, []);

  useEffect(() => {
    if (!mapReady || !mapHtml) {
      return;
    }

    postMessageToMap({
      type: hasInitializedRef.current ? 'UPDATE' : 'INIT',
      startLat: currentPosition.lat,
      startLng: currentPosition.lng,
      destinationLat: destination.lat,
      destinationLng: destination.lng,
      title: 'Ambulance Route',
      phaseLabel,
      destinationLabel,
      panelSubtitle,
      etaLabel: emergency?.ambulanceETA ? `${emergency.ambulanceETA} min` : '',
      routeCoordinates,
    });
    hasInitializedRef.current = true;
  }, [currentPosition?.lat, currentPosition?.lng, destination?.lat, destination?.lng, destinationLabel, emergency?.ambulanceETA, mapReady, mapHtml, panelSubtitle, phaseLabel, postMessageToMap, routeCoordinates]);

  if (!hospitalLocation) {
    return <div style={styles.empty}>Waiting for hospital location.</div>;
  }

  if (!mapHtml) {
    return <div style={styles.empty}>Waiting for an active ambulance route.</div>;
  }

  return (
    <div style={styles.shell}>
      <iframe
        ref={iframeRef}
        title="hospital-live-navigation"
        srcDoc={mapHtml}
        style={styles.frame}
        onLoad={() => setMapReady(true)}
      />
    </div>
  );
}
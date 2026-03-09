import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const [mapHtml, setMapHtml] = useState('');
  const [mapReady, setMapReady] = useState(false);

  const currentPosition = emergency?.ambulanceLocation || hospitalLocation;
  const destination = emergency?.status === 'patient_picked_up' || emergency?.status === 'arriving'
    ? hospitalLocation
    : emergency?.victimLocation || hospitalLocation;
  const destinationLabel = emergency?.status === 'patient_picked_up' || emergency?.status === 'arriving'
    ? hospitalName || 'Hospital'
    : 'Patient';
  const phaseLabel = getPhaseLabel(emergency, destinationLabel);
  const panelSubtitle = buildSubtitle(emergency, destinationLabel);

  const mapConfig = useMemo(() => {
    if (!currentPosition || !destination) {
      return null;
    }

    return {
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
    };
  }, [currentPosition, destination, destinationLabel, panelSubtitle, phaseLabel]);

  useEffect(() => {
    if (!mapConfig) {
      return;
    }

    setMapHtml(buildNavigationMapHtml(mapConfig));
    setMapReady(false);
    hasInitializedRef.current = false;
  }, [emergency?.emergencyId, mapConfig]);

  useEffect(() => {
    if (!mapReady || !mapConfig || !iframeRef.current?.contentWindow) {
      return;
    }

    const payload = {
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
    };

    iframeRef.current.contentWindow.postMessage(JSON.stringify(payload), '*');
    hasInitializedRef.current = true;
  }, [currentPosition, destination, destinationLabel, emergency?.ambulanceETA, mapReady, mapConfig, panelSubtitle, phaseLabel]);

  if (!hospitalLocation) {
    return <div style={styles.empty}>Waiting for hospital location.</div>;
  }

  if (!mapConfig) {
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
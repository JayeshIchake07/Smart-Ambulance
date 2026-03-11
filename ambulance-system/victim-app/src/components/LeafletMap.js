import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildNavigationMapHtml } from 'rapidaid-navigation-template';

const getPoint = (location, fallback) => {
  if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
    return location;
  }

  return fallback;
};

const LeafletMap = ({ victimLocation, ambulanceLocation, hospitalLocation, hospital, route, status, eta, style }) => {
  const webViewRef = useRef(null);
  const iframeRef = useRef(null);
  const hasInitializedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  const fallbackPoint = getPoint(victimLocation, { lat: 19.076, lng: 72.8777 });
  const currentPosition = getPoint(ambulanceLocation, fallbackPoint);
  const isToHospital = status === 'patient_picked_up' || status === 'arriving' || status === 'en_route_to_hospital';
  const destination = getPoint(isToHospital ? hospitalLocation : victimLocation, fallbackPoint);
  const destinationLabel = isToHospital ? 'Hospital' : 'Pickup Point';
  const phaseLabel = isToHospital ? 'Heading to Hospital' : 'Ambulance En Route';
  const panelSubtitle = isToHospital
    ? 'Your ambulance is taking the fastest route to the assigned hospital.'
    : 'Your ambulance is following the live route to your location.';
  const routeCoordinates = Array.isArray(route) && route.length > 1 ? route : [];
  const selectedHospitalMarkers = useMemo(() => {
    if (!hospitalLocation || typeof hospitalLocation.lat !== 'number' || typeof hospitalLocation.lng !== 'number') {
      return [];
    }

    return [{
      _id: hospital?._id,
      name: hospital?.name || 'Assigned Hospital',
      address: hospital?.address || '',
      location: hospitalLocation,
      availableBeds: hospital?.availableBeds,
      specialists: hospital?.specialists || ['general'],
      phone: hospital?.phone,
    }];
  }, [hospital?._id, hospital?.address, hospital?.availableBeds, hospital?.name, hospital?.phone, hospital?.specialists, hospitalLocation]);
  const mapInstanceKey = useMemo(() => {
    var first = routeCoordinates[0] || [];
    var last = routeCoordinates[routeCoordinates.length - 1] || [];
    return [
      isToHospital ? 'hospital' : 'pickup',
      currentPosition.lat,
      currentPosition.lng,
      destination.lat,
      destination.lng,
      routeCoordinates.length,
      first[0],
      first[1],
      last[0],
      last[1],
      selectedHospitalMarkers.length,
      selectedHospitalMarkers[0]?.location?.lat,
      selectedHospitalMarkers[0]?.location?.lng,
    ].join('|');
  }, [currentPosition.lat, currentPosition.lng, destination.lat, destination.lng, isToHospital, routeCoordinates, selectedHospitalMarkers]);

  const html = useMemo(() => buildNavigationMapHtml({
    startLat: currentPosition.lat,
    startLng: currentPosition.lng,
    destinationLat: destination.lat,
    destinationLng: destination.lng,
    title: 'Ambulance Tracking',
    phaseLabel,
    destinationLabel,
    panelSubtitle,
    markerVariant: 'arrow',
    hintText: 'Tap map to show navigation',
    routeCoordinates,
    hospitals: selectedHospitalMarkers,
  }), [destination.lat, destination.lng, destinationLabel, panelSubtitle, phaseLabel, routeCoordinates, selectedHospitalMarkers]);

  useEffect(() => {
    setMapReady(false);
    hasInitializedRef.current = false;
  }, [html]);

  const sendPostMessage = useCallback((payload) => {
    const message = JSON.stringify(payload);

    if (Platform.OS === 'web') {
      try {
        iframeRef.current?.contentWindow?.postMessage(message, '*');
      } catch (e) {}
      return;
    }

    if (webViewRef.current) {
      webViewRef.current.postMessage(message);
    }
  }, []);

  useEffect(() => {
    if (!mapReady) {
      return;
    }

    sendPostMessage({
      type: hasInitializedRef.current ? 'UPDATE' : 'INIT',
      startLat: currentPosition.lat,
      startLng: currentPosition.lng,
      destinationLat: destination.lat,
      destinationLng: destination.lng,
      title: 'Ambulance Tracking',
      phaseLabel,
      destinationLabel,
      panelSubtitle,
      etaLabel: eta ? `${Math.ceil(eta)} min` : '',
      routeCoordinates,
      hospitals: selectedHospitalMarkers,
    });

    hasInitializedRef.current = true;
  }, [currentPosition.lat, currentPosition.lng, destination.lat, destination.lng, destinationLabel, eta, mapReady, panelSubtitle, phaseLabel, routeCoordinates, selectedHospitalMarkers, sendPostMessage]);

  if (Platform.OS === 'web') {
    return (
      <iframe
        key={mapInstanceKey}
        ref={iframeRef}
        srcDoc={html}
        style={{ width: '100%', height: '100%', border: 'none', ...style }}
        title="map"
        onLoad={() => setMapReady(true)}
      />
    );
  }

  return (
    <WebView
      key={mapInstanceKey}
      ref={webViewRef}
      originWhitelist={['*']}
      source={{ html }}
      style={[{ flex: 1 }, style]}
      scrollEnabled={false}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState={false}
      onLoadEnd={() => setMapReady(true)}
    />
  );
};

export default LeafletMap;

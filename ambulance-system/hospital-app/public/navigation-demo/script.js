const startLatLng = L.latLng(12.9716, 77.5946);
const destinationLatLng = L.latLng(12.9352, 77.6245);

const map = L.map("map", {
  zoomControl: true,
  preferCanvas: true,
}).setView(startLatLng, 14);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const distanceElement = document.getElementById("distance");
const etaElement = document.getElementById("eta");
const instructionsElement = document.getElementById("instructions");

const ambulanceIcon = L.divIcon({
  className: "ambulance-marker",
  html: `
    <div class="ambulance-marker__inner">
      <svg viewBox="0 0 64 64" aria-hidden="true">
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
  `,
  iconSize: [54, 54],
  iconAnchor: [27, 27],
});

const destinationIcon = L.divIcon({
  className: "destination-marker",
  html: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const ambulanceMarker = L.marker(startLatLng, { icon: ambulanceIcon, zIndexOffset: 1000 }).addTo(map);
const destinationMarker = L.marker(destinationLatLng, { icon: destinationIcon }).addTo(map);

destinationMarker
  .bindPopup("Destination hospital")
  .openPopup();

let animationFrameId = null;
let animationTimeoutId = null;
let routeCoordinates = [];

const routingControl = L.Routing.control({
  waypoints: [startLatLng, destinationLatLng],
  addWaypoints: false,
  draggableWaypoints: false,
  fitSelectedRoutes: true,
  showAlternatives: false,
  lineOptions: {
    styles: [
      { color: "#34d399", opacity: 0.18, weight: 16 },
      { color: "#10b981", opacity: 0.95, weight: 8 },
      { color: "#ffffff", opacity: 0.85, weight: 2 },
    ],
    extendToWaypoints: true,
    missingRouteTolerance: 0,
  },
  createMarker: () => null,
  router: L.Routing.osrmv1({
    serviceUrl: "https://router.project-osrm.org/route/v1",
  }),
}).addTo(map);

routingControl.on("routesfound", (event) => {
  const route = event.routes[0];

  if (!route) {
    return;
  }

  routeCoordinates = route.coordinates;
  renderSummary(route.summary);
  renderInstructions(route.instructions || []);
  startAnimation(routeCoordinates);
});

routingControl.on("routingerror", () => {
  distanceElement.textContent = "Route unavailable";
  etaElement.textContent = "Try again later";
  instructionsElement.innerHTML = "<li>Routing service is currently unavailable.</li>";
});

function renderSummary(summary) {
  distanceElement.textContent = formatDistance(summary.totalDistance);
  etaElement.textContent = formatDuration(summary.totalTime);
}

function renderInstructions(instructions) {
  instructionsElement.innerHTML = "";

  if (!instructions.length) {
    instructionsElement.innerHTML = "<li>No turn-by-turn instructions available.</li>";
    return;
  }

  instructions.forEach((instruction) => {
    const item = document.createElement("li");
    const stepTitle = document.createElement("strong");
    stepTitle.textContent = instruction.text;

    const stepMeta = document.createElement("span");
    stepMeta.textContent = instruction.distance ? formatDistance(instruction.distance) : "Continue";

    item.appendChild(stepTitle);
    item.appendChild(stepMeta);
    instructionsElement.appendChild(item);
  });
}

function startAnimation(coordinates) {
  if (!coordinates.length) {
    return;
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }

   if (animationTimeoutId) {
    clearTimeout(animationTimeoutId);
  }

  const segmentPoints = buildAnimationPath(coordinates, 28);
  let pointIndex = 0;

  const animate = () => {
    const currentPoint = segmentPoints[pointIndex];
    const nextPoint = segmentPoints[Math.min(pointIndex + 1, segmentPoints.length - 1)];

    ambulanceMarker.setLatLng(currentPoint);
    updateAmbulanceHeading(currentPoint, nextPoint);
    map.panTo(currentPoint, {
      animate: true,
      duration: 0.35,
      easeLinearity: 0.25,
      noMoveStart: true,
    });

    if (pointIndex < segmentPoints.length - 1) {
      pointIndex += 1;
      animationTimeoutId = window.setTimeout(() => {
        animationFrameId = requestAnimationFrame(animate);
      }, 120);
      return;
    }

    animationFrameId = null;
    animationTimeoutId = null;
    etaElement.textContent = "Arrived";
  };

  animate();
}

function buildAnimationPath(coordinates, stepsPerSegment) {
  const result = [];

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const from = coordinates[index];
    const to = coordinates[index + 1];

    for (let step = 0; step < stepsPerSegment; step += 1) {
      const progress = step / stepsPerSegment;
      const lat = from.lat + (to.lat - from.lat) * progress;
      const lng = from.lng + (to.lng - from.lng) * progress;
      result.push(L.latLng(lat, lng));
    }
  }

  result.push(coordinates[coordinates.length - 1]);
  return result;
}

function updateAmbulanceHeading(from, to) {
  const markerElement = ambulanceMarker.getElement();

  if (!markerElement) {
    return;
  }

  const heading = calculateBearing(from, to);
  markerElement.style.setProperty("--heading", `${heading}deg`);
}

function calculateBearing(from, to) {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function formatDistance(distanceInMeters) {
  if (distanceInMeters >= 1000) {
    return `${(distanceInMeters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(distanceInMeters)} m`;
}

function formatDuration(durationInSeconds) {
  const totalMinutes = Math.round(durationInSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) {
    return `${minutes} min`;
  }

  return `${hours} hr ${minutes} min`;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}
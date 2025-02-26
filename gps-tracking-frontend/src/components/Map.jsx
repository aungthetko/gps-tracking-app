import { useState, useEffect, useRef } from "react";
import { GoogleMap, LoadScript, Marker, Polyline } from "@react-google-maps/api";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

const containerStyle = { width: "100%", height: "500px" };
const MIN_DISTANCE = 5; // Minimum movement in meters to update path

const haversineDistance = (coord1, coord2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLon = toRad(coord2.lng - coord1.lng);
  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};

const Map = () => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [path, setPath] = useState([]);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = { lat: position.coords.latitude, lng: position.coords.longitude };
          setCurrentLocation(location);
          setPath([location]); // Initialize path
        },
        (error) => console.error("Error getting location:", error),
        { enableHighAccuracy: true }
      );
    }

    socket.on("newLocation", (data) => {
      setPath((prevPath) => [...prevPath, data]);
      setCurrentLocation(data);
    });

    return () => socket.off("newLocation");
  }, []);

  const startTracking = () => {
    setTracking(true);
    setPath([]); // Reset path when starting a new session

    if ("geolocation" in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = { lat: position.coords.latitude, lng: position.coords.longitude };

          if (position.coords.accuracy > 20) {
            console.warn("Ignoring inaccurate location:", position.coords.accuracy);
            return;
          }

          if (path.length > 0) {
            const lastLocation = path[path.length - 1];
            const distance = haversineDistance(lastLocation, newLocation);

            if (distance < MIN_DISTANCE) {
              console.log("Skipping small movement:", distance);
              return;
            }
          }

          socket.emit("locationUpdate", newLocation); // Send to backend
          setPath((prevPath) => [...prevPath, newLocation]); // Update polyline path
          setCurrentLocation(newLocation); // Move marker
        },
        (error) => console.error("Tracking error:", error),
        { enableHighAccuracy: true }
      );
    }
  };

  const stopTracking = () => {
    setTracking(false);
    if (watchIdRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current); // Stop GPS tracking
      watchIdRef.current = null;
    }
  };

  return (
    <div>
      <button onClick={startTracking} style={{ marginRight: "10px", padding: "8px 15px", cursor: "pointer" }}>
        Start Tracking
      </button>
      <button onClick={stopTracking} style={{ padding: "8px 15px", cursor: "pointer" }}>
        Stop Tracking
      </button>

      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={currentLocation || { lat: 16.8409, lng: 96.1735 }}
          zoom={15}
        >
          {currentLocation && (
            <Marker
              position={currentLocation}
              icon={{
                url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                scaledSize: new window.google.maps.Size(40, 40),
              }}
            />
          )}

          {/* Draw movement path */}
          <Polyline
            path={path}
            options={{
              strokeColor: "#0000FF",
              strokeOpacity: 1,
              strokeWeight: 3,
            }}
          />
        </GoogleMap>
      </LoadScript>
    </div>
  );
};

export default Map;
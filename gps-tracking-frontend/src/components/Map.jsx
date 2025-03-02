import { useState, useEffect, useRef } from "react";
import { GoogleMap, LoadScript, Marker, Polyline } from "@react-google-maps/api";
import { io } from "socket.io-client";
import makerIcon from  "../icon/postman.png";
import { toast, ToastContainer } from "react-toastify";

const socket = io("http://localhost:3000");

const containerStyle = { width: "100%", height: "500px" };
const MIN_DISTANCE = 5;

const haversineDistance = (coord1, coord2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371000;
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
    toast.success("Tracking Started");

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
          socket.emit("locationUpdate", newLocation);
          setPath((prevPath) => [...prevPath, newLocation]);
          setCurrentLocation(newLocation);
        },
        (error) => console.error("Tracking error:", error),
        { enableHighAccuracy: true }
      );
    }
  };

  const stopTracking = () => {
    setTracking(false);
    toast.error("Tracking Stopped");
    if (watchIdRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
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
      <ToastContainer  position= "top-right" autoclose = {3000} />
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
                url: makerIcon,
                scaledSize: new window.google.maps.Size(30, 30),
              }}
            />
          )}

          <Polyline
            path={path}
            options={{
              strokeColor: "#FFFFFF",
              strokeOpacity: 0.5,
              strokeWeight: 10,
              geodesic: true
            }}
          />
          <Polyline
            path={path}
            options={{
              strokeColor: "#4285F4",
              strokeOpacity: 1,
              strokeWeight: 6,
              geodesic: true,
            }}
          />
        </GoogleMap>
      </LoadScript>
    </div>
  );
};

export default Map;
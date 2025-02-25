import { useState, useEffect, useRef } from "react";
import { GoogleMap, LoadScript, Marker, Polyline } from "@react-google-maps/api";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

const containerStyle = { width: "100%", height: "500px" };

const Map = () => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [path, setPath] = useState([]);
  const movementIcon = useRef(null);
  const trackingRef = useRef(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = { lat: position.coords.latitude, lng: position.coords.longitude };
          setCurrentLocation(location);
          setPath([location]); // Initialize path
        },
        (error) => console.error("Error getting location:", error)
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
    trackingRef.current = true; // Ensure interval has correct tracking state
    setPath([]); // Reset path for new tracking session

    intervalRef.current = setInterval(() => {
      if ("geolocation" in navigator && trackingRef.current) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const location = { lat: position.coords.latitude, lng: position.coords.longitude };
            socket.emit("locationUpdate", location); // Send to backend
            setPath((prevPath) => [...prevPath, location]); // Update polyline path
            setCurrentLocation(location); // Move marker
          },
          (error) => console.error("Tracking error:", error),
          { enableHighAccuracy: true }
        );
      }
    }, 3000);
  };

  const stopTracking = () => {
    setTracking(false);
    trackingRef.current = false;
    clearInterval(intervalRef.current);
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
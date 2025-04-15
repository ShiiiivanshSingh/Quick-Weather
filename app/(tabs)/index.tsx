import { Image, StyleSheet, Platform, TextInput, View, Text, ActivityIndicator, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { OPENWEATHER_API_KEY } from '@env';
import * as Location from 'expo-location';
import { LinearGradient, LinearGradientProps } from 'expo-linear-gradient'; // Import LinearGradient and type
import Constants from 'expo-constants'; // Import Constants
import { MaterialCommunityIcons } from '@expo/vector-icons'; // Import icons
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated'; // Import animation hooks
import AsyncStorage from '@react-native-async-storage/async-storage';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

// Define interfaces for the data structure
interface Weather {
  description: string;
  icon: string;
}

interface MainWeather {
  temp: number;
}

interface CurrentWeatherData {
  name: string;
  main: MainWeather;
  weather: Weather[];
  dt: number;
}

// Map OpenWeather icon codes to MaterialCommunityIcons names
const getWeatherIconName = (iconCode: string): string => {
  switch (iconCode) {
    case '01d': return 'weather-sunny';
    case '01n': return 'weather-night';
    case '02d': return 'weather-partly-cloudy';
    case '02n': return 'weather-night-partly-cloudy';
    case '03d':
    case '03n': return 'weather-cloudy';
    case '04d':
    case '04n': return 'weather-cloudy'; // Or 'cloud-outline'
    case '09d':
    case '09n': return 'weather-pouring';
    case '10d': return 'weather-rainy';
    case '10n': return 'weather-night-rainy'; // Check if this exists, else fallback
    case '11d':
    case '11n': return 'weather-lightning-rainy'; // Or 'weather-lightning'
    case '13d':
    case '13n': return 'weather-snowy';
    case '50d':
    case '50n': return 'weather-fog';
    default: return 'help-circle-outline'; // Fallback icon
  }
};

const FAVORITES_KEY = 'weatherAppFavorites';
const LAST_LOCATION_KEY = 'weatherAppLastLocation'; // Key for last location

// Type for storing last location info
interface LastLocationInfo {
  type: 'city' | 'coords';
  value: string | { lat: number; lon: number };
}

// Helper function to get gradient colors based on weather icon
const getGradientColors = (iconCode: string | null | undefined): string[] => {
  const defaultGradient = ['#4c669f', '#3b5998', '#192f6a']; // Default dark blue
  if (!iconCode) return defaultGradient;

  const codePrefix = iconCode.substring(0, 2);
  const timeOfDay = iconCode.endsWith('d') ? 'day' : 'night';

  switch (codePrefix) {
    case '01': // Clear
      return timeOfDay === 'day' ? ['#4792FF', '#1E63C7'] : ['#0B1538', '#2C3E50'];
    case '02': // Partly Cloudy
      return timeOfDay === 'day' ? ['#5C9DFF', '#2A75E3'] : ['#1A284D', '#3A506B'];
    case '03': // Cloudy
    case '04': // Broken Clouds
      return timeOfDay === 'day' ? ['#8AB8FF', '#5C8FCE'] : ['#43597A', '#6B7F9B'];
    case '09': // Shower Rain
    case '10': // Rain
      return timeOfDay === 'day' ? ['#748BAC', '#4A607F'] : ['#3C4A64', '#5A6F8F'];
    case '11': // Thunderstorm
      return ['#485563', '#29323C']; // Dark stormy grey
    case '13': // Snow
      return timeOfDay === 'day' ? ['#BCE0FF', '#87BBE3'] : ['#5C7A9A', '#7C9CC2'];
    case '50': // Mist/Fog
      return timeOfDay === 'day' ? ['#C9D6FF', '#E2E2E2'] : ['#6B7F9B', '#8A9CB8'];
    default:
      return defaultGradient;
  }
};

export default function HomeScreen() {
  const [city, setCity] = useState('');
  const [weatherData, setWeatherData] = useState<CurrentWeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);

  // Animation value
  const iconScale = useSharedValue(1);

  // Start animation when weather data is available
  useEffect(() => {
    if (weatherData) {
      iconScale.value = withRepeat(
        withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        -1, // Infinite repeats
        true // Reverse animation
      );
    } else {
      iconScale.value = withTiming(1, { duration: 500 }); // Reset scale when no data
    }
  }, [weatherData, iconScale]);

  // Animated style for the wrapper view
  const animatedWrapperStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: iconScale.value }],
      marginBottom: -10,
    };
  });

  // Check favorite status when weather data loads
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!weatherData) {
        setIsFavorite(false); // Reset if no weather data
        return;
      }
      try {
        const storedFavorites = await AsyncStorage.getItem(FAVORITES_KEY);
        if (storedFavorites !== null) {
          const favoritesList: {name: string}[] = JSON.parse(storedFavorites);
          setIsFavorite(favoritesList.some(fav => fav.name === weatherData.name));
        } else {
          setIsFavorite(false);
        }
      } catch (e) {
        console.error("Failed to check favorite status.", e);
        setIsFavorite(false); // Assume not favorite on error
      }
    };

    checkFavoriteStatus();
  }, [weatherData]); // Re-check whenever weatherData changes

  // Toggle favorite status for the current city
  const toggleFavorite = async () => {
    if (!weatherData) return;

    const currentCity = { name: weatherData.name };
    let updatedFavorites: {name: string}[] = [];

    try {
      const storedFavorites = await AsyncStorage.getItem(FAVORITES_KEY);
      if (storedFavorites !== null) {
        updatedFavorites = JSON.parse(storedFavorites);
      }

      if (isFavorite) {
        // Remove from favorites
        updatedFavorites = updatedFavorites.filter(fav => fav.name !== currentCity.name);
      } else {
        // Add to favorites (if not already there - safety check)
        if (!updatedFavorites.some(fav => fav.name === currentCity.name)) {
          updatedFavorites.push(currentCity);
        }
      }

      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updatedFavorites));
      setIsFavorite(!isFavorite); // Update UI state

    } catch (e) {
      console.error("Failed to toggle favorite.", e);
      Alert.alert("Error", `Could not ${isFavorite ? 'remove' : 'add'} city ${isFavorite ? 'from' : 'to'} favorites.`);
    }
  };

  // Helper to save last location
  const saveLastLocation = async (info: LastLocationInfo | null) => {
    try {
      if (info) {
        await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(info));
      } else {
        await AsyncStorage.removeItem(LAST_LOCATION_KEY); // Clear if fetch fails?
      }
    } catch (e) {
      console.error("Failed to save last location.", e);
    }
  };

  const fetchWeatherDataByCity = async (cityName: string) => {
    setLoading(true);
    setError(null);
    setWeatherData(null);
    setIsFavorite(false); // Reset favorite state on new search

    if (!OPENWEATHER_API_KEY) {
      setError('OpenWeatherMap API key is missing.');
      setLoading(false);
      return;
    }

    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${OPENWEATHER_API_KEY}&units=metric`;

    try {
      const weatherResponse = await axios.get<CurrentWeatherData>(weatherUrl);
      setWeatherData(weatherResponse.data);
      await saveLastLocation({ type: 'city', value: cityName }); // Save on success
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response) {
        if (err.response.status === 404) {
          setError(`City "${cityName}" not found.`);
        } else {
          setError(`Error fetching weather: ${err.response.data?.message || 'Unknown error'}`);
        }
      } else {
        setError('An unexpected error occurred while fetching weather.');
      }
      console.error("Error fetching weather data:", err);
      await saveLastLocation(null); // Clear last location on error?
    } finally {
      setLoading(false);
    }
  };

  const fetchWeatherDataByCoords = async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    setWeatherData(null);
    setIsFavorite(false); // Reset favorite state

    if (!OPENWEATHER_API_KEY) {
        setError('OpenWeatherMap API key is missing.');
        setLoading(false);
        return;
    }

    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;

    try {
        const weatherResponse = await axios.get<CurrentWeatherData>(weatherUrl);
        setWeatherData(weatherResponse.data);
        await saveLastLocation({ type: 'coords', value: { lat, lon } }); // Save on success
    } catch (err: any) {
        if (axios.isAxiosError(err) && err.response) {
            setError(`Error fetching location weather: ${err.response.data?.message || 'Unknown error'}`);
        } else {
            setError('An unexpected error occurred while fetching location weather.');
        }
        console.error("Error fetching location weather data:", err);
        await saveLastLocation(null); // Clear last location on error?
    } finally {
        setLoading(false);
    }
  };

  const handleSearch = () => {
    if (city.trim()) {
      fetchWeatherDataByCity(city.trim());
    } else {
      setError('Please enter a city name.');
    }
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied initially.');
        return;
      }
    })();
  }, []);

  // Refactored Initial Load Logic
  useEffect(() => {
    const loadInitialWeather = async () => {
      setLoading(true);
      let lastLocation: LastLocationInfo | null = null;

      // 1. Try loading last location from storage
      try {
        const storedLocation = await AsyncStorage.getItem(LAST_LOCATION_KEY);
        if (storedLocation) {
          lastLocation = JSON.parse(storedLocation);
        }
      } catch (e) {
        console.error("Failed to load last location", e);
      }

      if (lastLocation) {
        // 2. If last location exists, fetch its weather
        console.log('Loading weather for last location:', lastLocation);
        if (lastLocation.type === 'city' && typeof lastLocation.value === 'string') {
          await fetchWeatherDataByCity(lastLocation.value);
        } else if (lastLocation.type === 'coords' && typeof lastLocation.value === 'object') {
          await fetchWeatherDataByCoords(lastLocation.value.lat, lastLocation.value.lon);
        } else {
          // Invalid stored data, proceed as if no last location
          lastLocation = null; 
        }
      } 
      
      // 3. If NO last location was loaded OR it was invalid, try current location (check permission first)
      if (!lastLocation) {
        console.log('No valid last location found, checking current location permissions...');
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          status = (await Location.requestForegroundPermissionsAsync()).status;
        }

        if (status === 'granted') {
          console.log('Permission granted, fetching current location weather...');
          // Use the logic from handleGetCurrentLocation but don't set loading/error again
          try {
            const locationPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Location request timed out.')), 10000));
            const location = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject;
            await fetchWeatherDataByCoords(location.coords.latitude, location.coords.longitude);
          } catch (error: any) {
            setError(`Could not fetch initial location: ${error.message || 'Unknown error'}`);
            console.error("Error getting initial location:", error);
            setLoading(false); // Ensure loading stops if initial fetch fails
          }
        } else {
          console.log('Permission denied, cannot fetch current location.');
          setError('Location permission needed to fetch weather automatically, or search for a city.'); // Inform user
          setLoading(false); // No weather to load
        }
      }
      // setLoading(false) is handled within the fetch functions called above
    };

    loadInitialWeather();
  }, []); // Run only once on mount

  const handleGetCurrentLocation = async (showLoading = true) => {
    // This function now primarily handles the *button press*
    if (showLoading) {
        setLoading(true);
        setError(null);
    }
    // Permission check is important here too in case it was denied initially
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      let permResponse = await Location.requestForegroundPermissionsAsync();
      if (permResponse.status !== 'granted') {
          setError('Permission to access location was denied.');
          if (showLoading) setLoading(false);
          return;
      }
      status = permResponse.status; // Update status if granted now
    }

    // If permission is granted (either initially or just now)
    if (status === 'granted') {
        try {
            const locationPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Location request timed out.')), 10000));
            const location = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject;
            // Call fetch directly - it handles loading state and saving location
            await fetchWeatherDataByCoords(location.coords.latitude, location.coords.longitude);
        } catch (error: any) {
            setError(`Could not fetch location: ${error.message || 'Unknown error'}`);
            console.error("Error getting location on button press:", error);
            // Ensure loading is stopped if fetchWeatherDataByCoords fails somehow before its finally block
            if (showLoading) setLoading(false);
        }
    } else { 
        // This case should technically be handled by the permission check above,
        // but added for robustness.
        setError('Permission to access location was denied.');
        if (showLoading) setLoading(false);
    }
  };

  // Determine current gradient based on weather data
  const currentGradient = getGradientColors(weatherData?.weather?.[0]?.icon);

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={currentGradient as unknown as LinearGradientProps['colors']}
        style={styles.gradientContainer}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter city name"
            placeholderTextColor="#ccc"
            value={city}
            onChangeText={setCity}
            onSubmitEditing={handleSearch}
          />
          <TouchableOpacity onPress={handleSearch} style={styles.searchButton} disabled={loading}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => handleGetCurrentLocation()} style={styles.locationButton} disabled={loading}>
            <Text style={styles.locationButtonText}>Use My Location</Text>
        </TouchableOpacity>

        {loading && <ActivityIndicator size="large" color="#ffffff" style={styles.loader} />}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {weatherData && (
          <View style={styles.weatherContainer}>
            <TouchableOpacity onPress={toggleFavorite} style={styles.favoriteButton}>
              <MaterialCommunityIcons
                name={isFavorite ? "heart" : "heart-outline"}
                size={30}
                color={isFavorite ? "#ff6b6b" : "#ffffff"}
              />
            </TouchableOpacity>

            <Text style={styles.locationText}>{weatherData.name}</Text>
            <Animated.View style={animatedWrapperStyle}>
               <MaterialCommunityIcons
                 name={getWeatherIconName(weatherData.weather[0].icon) as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                 size={160}
                 color="#ffffff"
                 style={styles.weatherIconStyle}
               />
            </Animated.View>
            <Text style={styles.temperatureText}>{Math.round(weatherData.main.temp)}°C</Text>
            <Text style={styles.descriptionText}>{weatherData.weather[0].description}</Text>
            <Text style={styles.dateText}>{new Date(weatherData.dt * 1000).toLocaleDateString()}</Text>
          </View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#192f6a',
    paddingTop: Platform.OS === 'android' ? Constants.statusBarHeight : 0,
  },
  gradientContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 15,
  },
  input: {
    flex: 1,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 15,
    color: '#ffffff',
    fontSize: 16,
    marginRight: 10,
  },
  searchButton: {
    backgroundColor: '#4CAF50', // Green
    paddingHorizontal: 15,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
   locationButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 20,
    alignSelf: 'center',
  },
  locationButtonText: {
    color: '#ffffff',
    fontSize: 14,
  },
  loader: {
    marginTop: 30,
  },
  weatherContainer: {
    marginTop: 30,
    alignItems: 'center',
    padding: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Slightly adjusted transparency
    borderRadius: 20, // More rounded corners
    width: '95%',
    position: 'relative', // Needed for absolute positioning of the button
  },
  locationText: {
    fontSize: 32, // Larger font
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  weatherIconStyle: {
    // Basic styles for the icon itself, animation is on the wrapper
  },
  temperatureText: {
    fontSize: 72, // Even larger temperature
    fontWeight: '200', // Thinner weight
    color: '#ffffff',
    marginVertical: -5, // Adjust spacing
  },
  descriptionText: {
    fontSize: 22, // Larger description
    textTransform: 'capitalize',
    color: '#eee',
    marginBottom: 15,
  },
  dateText: {
    fontSize: 16,
    color: '#ccc',
  },
  errorText: {
    color: '#ffdddd', // Lighter red for dark background
    marginTop: 20,
    textAlign: 'center',
    fontSize: 16,
    backgroundColor: 'rgba(255, 0, 0, 0.2)', // Subtle red background
    padding: 10,
    borderRadius: 5,
    width: '90%',
  },
  favoriteButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
    zIndex: 1, // Ensure it's above other elements
  },
});

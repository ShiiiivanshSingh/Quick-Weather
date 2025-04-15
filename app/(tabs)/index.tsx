import { Image, StyleSheet, Platform, TextInput, View, Text, ActivityIndicator, SafeAreaView, TouchableOpacity } from 'react-native';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { OPENWEATHER_API_KEY } from '@env';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient'; // Import LinearGradient
import Constants from 'expo-constants'; // Import Constants
import { MaterialCommunityIcons } from '@expo/vector-icons'; // Import icons
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated'; // Import animation hooks

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

export default function HomeScreen() {
  const [city, setCity] = useState('');
  const [weatherData, setWeatherData] = useState<CurrentWeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const fetchWeatherDataByCity = async (cityName: string) => {
    setLoading(true);
    setError(null);
    setWeatherData(null);

    if (!OPENWEATHER_API_KEY) {
      setError('OpenWeatherMap API key is missing.');
      setLoading(false);
      return;
    }

    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${OPENWEATHER_API_KEY}&units=metric`;

    try {
      const weatherResponse = await axios.get<CurrentWeatherData>(weatherUrl);
      setWeatherData(weatherResponse.data);
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
    } finally {
      setLoading(false);
    }
  };

  const fetchWeatherDataByCoords = async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    setWeatherData(null);

    if (!OPENWEATHER_API_KEY) {
        setError('OpenWeatherMap API key is missing.');
        setLoading(false);
        return;
    }

    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;

    try {
        const weatherResponse = await axios.get<CurrentWeatherData>(weatherUrl);
        setWeatherData(weatherResponse.data);
    } catch (err: any) {
        if (axios.isAxiosError(err) && err.response) {
            setError(`Error fetching location weather: ${err.response.data?.message || 'Unknown error'}`);
        } else {
            setError('An unexpected error occurred while fetching location weather.');
        }
        console.error("Error fetching location weather data:", err);
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

  const handleGetCurrentLocation = async (showLoading = true) => {
    if (showLoading) {
        setLoading(true);
        setError(null);
    }

    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      let permResponse = await Location.requestForegroundPermissionsAsync();
      if (permResponse.status !== 'granted') {
          setError('Permission to access location was denied.');
          if (showLoading) setLoading(false);
          return;
      }
    }

    try {
        const locationPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Location request timed out.')), 10000)
        );

        const location = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject;

        fetchWeatherDataByCoords(location.coords.latitude, location.coords.longitude);
    } catch (error: any) {
        setError(`Could not fetch location: ${error.message || 'Unknown error'}`);
        console.error("Error getting location:", error);
        if (showLoading) setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={weatherData ? ['#6a8ee0', '#4a6fbe', '#2a4f9c'] : ['#4c669f', '#3b5998', '#192f6a']}
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
});

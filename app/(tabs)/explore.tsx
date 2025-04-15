import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  Platform,
  TextInput,
  TouchableOpacity,
  Keyboard,
  Alert,
} from 'react-native';
import axios from 'axios';
import { OPENWEATHER_API_KEY } from '@env';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

// Reuse types from HomeScreen (or define them here if needed)
interface Weather {
  description: string;
  icon: string;
}
interface MainWeather {
  temp: number;
}
interface CityWeatherData {
  name: string;
  main: MainWeather;
  weather: Weather[];
  dt: number;
  id: string; // Add id for keyExtractor
}

// Map OpenWeather icon codes (copied from HomeScreen - consider moving to a shared util)
const getWeatherIconName = (iconCode: string): string => {
  switch (iconCode) {
    case '01d': return 'weather-sunny';
    case '01n': return 'weather-night';
    case '02d': return 'weather-partly-cloudy';
    case '02n': return 'weather-night-partly-cloudy';
    case '03d':
    case '03n': return 'weather-cloudy';
    case '04d':
    case '04n': return 'weather-cloudy';
    case '09d':
    case '09n': return 'weather-pouring';
    case '10d': return 'weather-rainy';
    case '10n': return 'weather-night-rainy';
    case '11d':
    case '11n': return 'weather-lightning-rainy';
    case '13d':
    case '13n': return 'weather-snowy';
    case '50d':
    case '50n': return 'weather-fog';
    default: return 'help-circle-outline';
  }
};

const FAVORITES_KEY = 'weatherAppFavorites';

export default function ExploreScreen() {
  const [favoriteCities, setFavoriteCities] = useState<{name: string}[]>([]);
  const [favoriteCitiesWeather, setFavoriteCitiesWeather] = useState<CityWeatherData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFavoriteCity, setNewFavoriteCity] = useState('');

  const loadAndFetchFavorites = async () => {
    setLoading(true);
    setError(null);
    setFavoriteCitiesWeather([]);
    setFavoriteCities([]);

    let loadedFavorites: { name: string }[] = [];
    try {
      const storedFavorites = await AsyncStorage.getItem(FAVORITES_KEY);
      if (storedFavorites !== null) {
        loadedFavorites = JSON.parse(storedFavorites);
        setFavoriteCities(loadedFavorites);
      }
    } catch (e) {
      console.error("Failed to load favorites for explore.", e);
      setError("Could not load favorite cities list.");
      setLoading(false);
      return;
    }

    if (loadedFavorites.length === 0) {
      setLoading(false);
      return;
    }

    if (!OPENWEATHER_API_KEY) {
      setError('API key is missing.');
      setLoading(false);
      return;
    }

    try {
      const promises = loadedFavorites.map((fav) =>
        axios.get<CityWeatherData>(
          `https://api.openweathermap.org/data/2.5/weather?q=${fav.name}&appid=${OPENWEATHER_API_KEY}&units=metric`
        ).then(response => ({ ...response.data, id: fav.name }))
      );
      const results = await Promise.allSettled(promises);
      const successfulData: CityWeatherData[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulData.push(result.value);
        } else {
          console.error(`Failed to fetch weather for favorite ${loadedFavorites[index].name}:`, result.reason);
        }
      });
      setFavoriteCitiesWeather(successfulData);
    } catch (err) {
      setError('An error occurred while fetching favorite city weather data.');
      console.error('Overall fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAndFetchFavorites();
    }, [])
  );

  const addFavorite = async () => {
    const cityName = newFavoriteCity.trim();
    if (!cityName) return;

    const normalizedCityName = cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();

    if (favoriteCities.some(fav => fav.name.toLowerCase() === normalizedCityName.toLowerCase())) {
      Alert.alert("Already Favorite", `"${normalizedCityName}" is already in your favorites.`);
      setNewFavoriteCity('');
      Keyboard.dismiss();
      return;
    }

    const newFav = { name: normalizedCityName };
    const updatedFavorites = [...favoriteCities, newFav];
    updatedFavorites.sort((a, b) => a.name.localeCompare(b.name));
    setFavoriteCities(updatedFavorites);
    setNewFavoriteCity('');
    Keyboard.dismiss();

    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updatedFavorites));
      loadAndFetchFavorites();
    } catch (e) {
      console.error("Failed to save new favorite.", e);
      Alert.alert("Error", `Could not add "${normalizedCityName}" to favorites.`);
      setFavoriteCities(favoriteCities.filter(fav => fav.name !== normalizedCityName));
    }
  };

  const removeFavorite = async (cityName: string) => {
    const updatedFavorites = favoriteCities.filter(fav => fav.name !== cityName);
    const updatedWeather = favoriteCitiesWeather.filter(city => city.name !== cityName);

    setFavoriteCities(updatedFavorites);
    setFavoriteCitiesWeather(updatedWeather);

    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updatedFavorites));
    } catch (e) {
      console.error("Failed to remove favorite.", e);
      Alert.alert("Error", "Could not remove city from favorites.");
      loadAndFetchFavorites();
    }
  };

  const renderCityWeather = ({ item }: { item: CityWeatherData }) => (
    <View style={styles.cityCard}>
      <View style={styles.cityCardHeader}>
        <Text style={styles.cityName}>{item.name}</Text>
        <Text style={styles.cityTemp}>{Math.round(item.main.temp)}°</Text>
      </View>
      <View style={styles.cityCardBody}>
        <MaterialCommunityIcons
           name={getWeatherIconName(item.weather[0].icon) as any}
           size={30}
           color="#ffffff"
           style={styles.cityIcon}
        />
        <Text style={styles.cityDesc}>{item.weather[0].description}</Text>
      </View>
      <TouchableOpacity onPress={() => removeFavorite(item.name)} style={styles.removeButton}>
        <MaterialCommunityIcons name="heart-off-outline" size={22} color="#ff8a8a" />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#4c669f', '#3b5998', '#192f6a']} style={styles.gradientContainer}>
        <Text style={styles.title}>Explore Your Favorites</Text>

        <View style={styles.addFavoriteContainer}>
           <TextInput
            style={styles.input}
            placeholder="Add a new favorite city..."
            placeholderTextColor="#a0a0a0"
            value={newFavoriteCity}
            onChangeText={setNewFavoriteCity}
            onSubmitEditing={addFavorite}
            returnKeyType="done"
            autoCapitalize="words"
          />
          <TouchableOpacity onPress={addFavorite} style={styles.addButton}>
            <MaterialCommunityIcons name="plus-circle-outline" size={26} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {loading && favoriteCitiesWeather.length === 0 && <ActivityIndicator size="large" color="#ffffff" style={styles.loader} />}
        {error && <Text style={styles.errorText}>{error}</Text>}
        
        {!loading && favoriteCities.length === 0 && (
            <Text style={styles.emptyText}>Add your favorite cities using the input above.</Text>
        )}
        
        {favoriteCities.length > 0 && (
          <FlatList
            data={favoriteCitiesWeather} 
            renderItem={renderCityWeather}
            keyExtractor={(item) => item.id}
            numColumns={1}
            contentContainerStyle={styles.listContainer}
            style={styles.listStyle}
            keyboardShouldPersistTaps="handled"
          />
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
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 15,
  },
  addFavoriteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 5,
    marginBottom: 15,
  },
  input: {
    flex: 1,
    height: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 15,
    color: '#ffffff',
    fontSize: 16,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: 'rgba(76, 175, 80, 0.7)',
    padding: 9,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  listStyle: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 0,
    paddingBottom: 60,
  },
  cityCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 12,
    position: 'relative',
  },
  cityCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingRight: 35,
  },
  cityCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cityName: {
    fontSize: 22,
    fontWeight: '500',
    color: '#ffffff',
    flex: 1,
    marginRight: 5,
  },
  cityIcon: {
    marginRight: 8,
  },
  cityTemp: {
    fontSize: 38,
    fontWeight: '300',
    color: '#ffffff',
    textAlign: 'right',
  },
  cityDesc: {
    fontSize: 16,
    color: '#eee',
    textTransform: 'capitalize',
    flex: 1,
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.2)',
    zIndex: 1,
  },
  emptyText: {
    color: '#ccc',
    textAlign: 'center',
    marginTop: 40,
    marginHorizontal: 20,
    fontSize: 16,
    lineHeight: 22,
  },
  errorText: {
    color: '#ffdddd',
    marginTop: 20,
    textAlign: 'center',
    fontSize: 16,
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 20,
  },
});

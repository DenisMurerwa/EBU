import { useColorScheme } from '@/components/useColorScheme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { supabase } from './lib/supabase';

export {
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'auth',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [initialRoute, setInitialRoute] = useState('auth');

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          const { data, error } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .single();
          if (data && !error) {
            setInitialRoute('(tabs)');
          }
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setIsCheckingSession(false);
        if (loaded) {
          SplashScreen.hideAsync();
        }
      }
    };
    checkSession();
  }, [loaded]);

  if (!loaded || isCheckingSession) {
    return null;
  }

  return <RootLayoutNav initialRoute={initialRoute} />;
}

function RootLayoutNav({ initialRoute }: { initialRoute: string }) {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName={initialRoute}>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <Toast
        position="top"
        topOffset={Platform.OS === 'ios' ? 60 : 40}
        visibilityTime={3000}
        autoHide={true}
        config={{
          success: ({ text1, text2, ...rest }) => (
            <View style={{
              backgroundColor: '#E6F7F0',
              borderLeftWidth: 4,
              borderLeftColor: '#00A651',
              padding: 16,
              borderRadius: 8,
              marginHorizontal: 20,
              width: '90%',
            }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{text1}</Text>
              <Text style={{ fontSize: 14, color: '#6B7280' }}>{text2}</Text>
            </View>
          ),
          error: ({ text1, text2, ...rest }) => (
            <View style={{
              backgroundColor: '#FEE2E2',
              borderLeftWidth: 4,
              borderLeftColor: '#EF4444',
              padding: 16,
              borderRadius: 8,
              marginHorizontal: 20,
              width: '90%',
            }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{text1}</Text>
              <Text style={{ fontSize: 14, color: '#6B7280' }}>{text2}</Text>
            </View>
          ),
        }}
      />
    </ThemeProvider>
  );
}
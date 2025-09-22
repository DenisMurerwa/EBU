import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { supabase } from './lib/supabase';

const { width, height } = Dimensions.get('window');

interface FormData {
  idNumber: string;
  phoneNumber: string;
  name: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  idNumber?: string;
  phoneNumber?: string;
  name?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

const AuthPage: React.FC = () => {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    idNumber: '',
    phoneNumber: '+254',
    name: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const colors = {
    primary: '#00A651',
    primaryDark: '#008A44',
    secondary: '#FFFFFF',
    accent: '#E6F7F0',
    red: '#F87171',
    redLight: '#FEE2E2',
    text: '#1F2937',
    textLight: '#6B7280',
    error: '#F87171',
    border: '#E5E7EB',
    background: '#F9FAFB',
    cardBg: '#FFFFFF',
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!isLogin) {
      if (!formData.idNumber.trim()) {
        newErrors.idNumber = 'ID number is required';
      } else if (formData.idNumber.trim().length < 8) {
        newErrors.idNumber = 'ID number must be at least 8 digits';
      } else if (!/^\d+$/.test(formData.idNumber.trim())) {
        newErrors.idNumber = 'ID number must contain only digits';
      }
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else {
      const phoneDigits = formData.phoneNumber.replace('+254', '');
      if (!/^[17]\d{8}$/.test(phoneDigits)) {
        newErrors.phoneNumber = 'Please enter 9 digits after +254 (starting with 1 or 7)';
      }
    }

    if (!isLogin) {
      if (!formData.name.trim()) {
        newErrors.name = 'Name is required';
      } else if (formData.name.trim().length < 2) {
        newErrors.name = 'Name must be at least 2 characters';
      }
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!isLogin) {
      if (!formData.confirmPassword.trim()) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatPhoneNumber = (phone: string): string => {
    if (!phone.startsWith('+254')) {
      return '+254';
    }
    const digits = phone.substring(4).replace(/\D/g, '');
    const limitedDigits = digits.substring(0, 9);
    return '+254' + limitedDigits;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const phoneDigits = formData.phoneNumber.replace('+254', '');
      const fullPhoneNumber = '+254' + phoneDigits;

      // Check for existing phone number
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone_number', fullPhoneNumber)
        .single();

      if (existingUser) {
        setErrors({ general: 'Phone number already registered. Please login instead.' });
        setLoading(false);
        return;
      }

      // Check for existing ID number
      const { data: existingId } = await supabase
        .from('users')
        .select('id')
        .eq('id_number', formData.idNumber.trim())
        .single();

      if (existingId) {
        setErrors({ general: 'ID Number already exists. Please use a different ID.' });
        setLoading(false);
        return;
      }

      // TODO: Hash password in production using bcrypt or similar
      const { data, error } = await supabase
        .from('users')
        .insert([
          {
            phone_number: fullPhoneNumber,
            name: formData.name.trim(),
            id_number: formData.idNumber.trim(),
            password: formData.password, // Replace with hashed password in production
            is_admin: false,
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Store user session
      await AsyncStorage.setItem('userId', data.id);
      await AsyncStorage.setItem('userName', data.name);

      Toast.show({
        type: 'success',
        text1: 'Registration Successful',
        text2: 'Your account has been created.',
        position: 'top',
        visibilityTime: 3000,
      });

      setFormData({ idNumber: '', phoneNumber: '+254', name: '', password: '', confirmPassword: '' });
      router.push('/(tabs)');
    } catch (error: any) {
      console.error('Registration error:', error);
      setErrors({
        general: error.message || 'Registration failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const phoneDigits = formData.phoneNumber.replace('+254', '');
      const fullPhoneNumber = '+254' + phoneDigits;

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, password')
        .eq('phone_number', fullPhoneNumber)
        .single();

      if (userError || !user) {
        setErrors({ general: 'Phone number not found. Please register first.' });
        setLoading(false);
        return;
      }

      // TODO: Compare hashed password in production
      if (user.password !== formData.password) {
        setErrors({ general: 'Invalid phone number or password.' });
        setLoading(false);
        return;
      }

      // Store user session
      await AsyncStorage.setItem('userId', user.id);
      await AsyncStorage.setItem('userName', user.name);

      Toast.show({
        type: 'success',
        text1: 'Login Successful',
        text2: `Welcome back, ${user.name}!`,
        position: 'top',
        visibilityTime: 3000,
      });

      setFormData({ idNumber: '', phoneNumber: '+254', name: '', password: '', confirmPassword: '' });
      router.push('/(tabs)');
    } catch (error: any) {
      console.error('Login error:', error);
      setErrors({
        general: error.message || 'Login failed. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderError = (error?: string) => {
    if (!error) return null;
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  };

  const renderLabel = (first: string, second: string) => (
    <Text style={styles.label}>
      <Text style={{ color: colors.primary }}>{first}</Text>
      <Text style={{ color: colors.red }}> {second}</Text>
    </Text>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#00A651', '#008A44', '#F87171']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <Text style={styles.title}>Fero Genesis Technologies</Text>
          <Text style={styles.subtitle}>
            <Text style={{ color: colors.accent }}>FTTH</Text>
            <Text style={{ color: colors.accent }}> & FTTB</Text>
            <Text style={{ color: colors.accent }}> Sales Leaderboard</Text>
          </Text>
          <Text style={[styles.description, { color: colors.accent }]}>
            Track your sales performance and compete with fellow agents
          </Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.formContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.formCard}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, isLogin && styles.activeTab]}
                onPress={() => {
                  setIsLogin(true);
                  setErrors({});
                  setFormData({ idNumber: '', phoneNumber: '+254', name: '', password: '', confirmPassword: '' });
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isLogin && styles.activeTabText]}>
                  Login
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, !isLogin && styles.activeTab]}
                onPress={() => {
                  setIsLogin(false);
                  setErrors({});
                  setFormData({ idNumber: '', phoneNumber: '+254', name: '', password: '', confirmPassword: '' });
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>
                  Register
                </Text>
              </TouchableOpacity>
            </View>

            {errors.general && (
              <View style={styles.generalErrorContainer}>
                <Text style={styles.generalErrorText}>{errors.general}</Text>
              </View>
            )}

            {!isLogin && (
              <View style={styles.inputContainer}>
                {renderLabel('ID', 'Number')}
                <TextInput
                  style={[styles.input, errors.idNumber && styles.inputError]}
                  placeholder="Enter your ID number"
                  placeholderTextColor={errors.idNumber ? colors.red : colors.textLight}
                  value={formData.idNumber}
                  onChangeText={(text) => setFormData({ ...formData, idNumber: text.replace(/\D/g, '') })}
                  autoCapitalize="none"
                  editable={!loading}
                  keyboardType="numeric"
                />
                {renderError(errors.idNumber)}
              </View>
            )}

            <View style={styles.inputContainer}>
              {renderLabel('Phone', 'Number')}
              <TextInput
                style={[styles.input, styles.phoneInput, errors.phoneNumber && styles.inputError]}
                placeholder="+254XXXXXXXXX"
                placeholderTextColor={errors.phoneNumber ? colors.red : colors.textLight}
                value={formData.phoneNumber}
                onChangeText={(text) => setFormData({ ...formData, phoneNumber: formatPhoneNumber(text) })}
                keyboardType="phone-pad"
                maxLength={13}
                editable={!loading}
              />
              {renderError(errors.phoneNumber)}
            </View>

            {!isLogin && (
              <View style={styles.inputContainer}>
                {renderLabel('Full', 'Name')}
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  placeholder="Enter your full name"
                  placeholderTextColor={errors.name ? colors.red : colors.textLight}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  autoCapitalize="words"
                  editable={!loading}
                />
                {renderError(errors.name)}
              </View>
            )}

            <View style={styles.inputContainer}>
              {renderLabel('Pass', 'word')}
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
                  placeholder="Enter your password"
                  placeholderTextColor={errors.password ? colors.red : colors.textLight}
                  value={formData.password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color={errors.password ? colors.error : colors.textLight}
                  />
                </TouchableOpacity>
              </View>
              {renderError(errors.password)}
            </View>

            {!isLogin && (
              <View style={styles.inputContainer}>
                {renderLabel('Confirm', 'Password')}
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, errors.confirmPassword && styles.inputError]}
                    placeholder="Confirm your password"
                    placeholderTextColor={errors.confirmPassword ? colors.red : colors.textLight}
                    value={formData.confirmPassword}
                    onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                    secureTextEntry={!showConfirmPassword}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={24}
                      color={errors.confirmPassword ? colors.error : colors.textLight}
                    />
                  </TouchableOpacity>
                </View>
                {renderError(errors.confirmPassword)}
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={isLogin ? handleLogin : handleRegister}
              disabled={loading}
              activeOpacity={0.6}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={colors.secondary} size="small" />
                  <Text style={[styles.buttonText, { color: colors.secondary }]}>
                    {isLogin ? 'Signing in...' : 'Creating account...'}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.buttonText, { color: colors.secondary }]}>
                  {isLogin ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <View style={styles.brandContainer}>
                <Text style={styles.brandText}>Powered by</Text>
                <View style={styles.brandNameContainer}>
                  <Text style={[styles.brandName, { color: colors.primary }]}>Fero</Text>
                  <Text style={[styles.brandName, { color: colors.red, fontWeight: '900' }]}>Genesis</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  formContainer: {
    flex: 1,
    marginTop: -15,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    minHeight: height * 0.6,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    marginBottom: 24,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#00A651',
    elevation: 2,
    shadowColor: '#00A651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  generalErrorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F87171',
  },
  generalErrorText: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 20,
    width: '100%',
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FAFAFA',
    fontWeight: '500',
    width: '100%',
  },
  inputError: {
    borderColor: '#F87171',
    backgroundColor: '#FEF2F2',
  },
  phoneInput: {
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#F87171',
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#F87171',
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#F87171',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    minHeight: 56,
  },
  buttonDisabled: {
    backgroundColor: '#6B7280',
    elevation: 0,
    shadowOpacity: 0,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  brandContainer: {
    alignItems: 'center',
  },
  brandText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  brandNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

export default AuthPage;
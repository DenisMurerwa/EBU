import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

const colors = {
  primary: '#00A651',
  primaryDark: '#008A44',
  primaryLight: '#10B981',
  secondary: '#FFFFFF',
  accent: '#E6F7F0',
  red: '#EF4444',
  text: '#111827',
  textLight: '#6B7280',
  textMuted: '#9CA3AF',
  background: '#F8FAFC',
  cardBg: '#FFFFFF',
  border: '#E5E7EB',
  shadow: 'rgba(0, 0, 0, 0.1)',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

interface UserProfile {
  id: string;
  name: string;
  is_admin: boolean;
  created_at: string;
}

interface FormData {
  name: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface FormErrors {
  [key: string]: string;
}

const ProfilePage: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        Toast.show({
          type: 'error',
          text1: 'Session Expired',
          text2: 'Please log in to continue.',
          position: 'top',
          visibilityTime: 3000,
        });
        router.replace('/auth');
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, is_admin, created_at')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        console.error('User fetch error:', userError);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load profile data.',
          position: 'top',
          visibilityTime: 3000,
        });
        await AsyncStorage.removeItem('userId');
        router.replace('/auth');
        return;
      }

      setUserProfile(userData);
      setFormData(prev => ({ ...prev, name: userData.name }));
    } catch (error) {
      console.error('Profile load error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load profile. Please try again.',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const validateNameForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters long';
    } else if (formData.name.trim().length > 50) {
      errors.name = 'Name must be less than 50 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePasswordForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    if (!formData.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 6) {
      errors.newPassword = 'New password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (formData.currentPassword === formData.newPassword) {
      errors.newPassword = 'New password must be different from current password';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdateName = async () => {
    if (!validateNameForm()) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ 
          name: formData.name.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userProfile!.id);

      if (error) throw error;

      setUserProfile(prev => prev ? { ...prev, name: formData.name.trim() } : null);
      setEditingName(false);
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Profile updated successfully!',
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (error) {
      console.error('Name update error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update profile. Please try again.',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!validatePasswordForm()) return;

    setUpdating(true);
    try {
      // First verify current password
      const { data: userData, error: verifyError } = await supabase
        .from('users')
        .select('password')
        .eq('id', userProfile!.id)
        .single();

      if (verifyError) throw verifyError;

      if (userData.password !== formData.currentPassword) {
        setFormErrors({ currentPassword: 'Current password is incorrect' });
        setUpdating(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          password: formData.newPassword,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userProfile!.id);

      if (updateError) throw updateError;

      // Reset password form
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      setChangingPassword(false);
      
      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: 'Password changed successfully!',
        position: 'top',
        visibilityTime: 3000,
      });
    } catch (error) {
      console.error('Password change error:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to change password. Please try again.',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('userId');
              Toast.show({
                type: 'success',
                text1: 'Logged Out',
                text2: 'You have been logged out successfully.',
                position: 'top',
                visibilityTime: 2000,
              });
              router.replace('/auth');
            } catch (error) {
              console.error('Logout error:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to logout. Please try again.',
                position: 'top',
                visibilityTime: 3000,
              });
            }
          },
        },
      ]
    );
  };

  const cancelNameEdit = () => {
    setFormData(prev => ({ ...prev, name: userProfile?.name || '' }));
    setEditingName(false);
    setFormErrors({});
  };

  const cancelPasswordChange = () => {
    setFormData(prev => ({
      ...prev,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }));
    setChangingPassword(false);
    setFormErrors({});
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <Text style={styles.title}>Profile</Text>
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorTextLarge}>Failed to load profile</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.secondary} />
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.placeholder} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Info Card */}
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={[colors.primary, colors.primaryLight]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {userProfile.name.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userProfile.name}</Text>
              <Text style={styles.profileRole}>
                {userProfile.is_admin ? 'Administrator' : 'Sales Agent'}
              </Text>
              <Text style={styles.profileDate}>
                Member since {formatDate(userProfile.created_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* Edit Name Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Personal Information</Text>
            {!editingName && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setEditingName(true)}
              >
                <Ionicons name="pencil" size={18} color={colors.primary} />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[
                styles.input,
                !editingName && styles.disabledInput,
                formErrors.name && styles.inputError,
              ]}
              value={formData.name}
              onChangeText={(text) => {
                setFormData(prev => ({ ...prev, name: text }));
                if (formErrors.name) {
                  setFormErrors(prev => ({ ...prev, name: '' }));
                }
              }}
              placeholder="Enter your full name"
              placeholderTextColor={colors.textMuted}
              editable={editingName}
              maxLength={50}
            />
            {formErrors.name && (
              <Text style={styles.errorText}>{formErrors.name}</Text>
            )}
          </View>

          {editingName && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={cancelNameEdit}
                disabled={updating}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleUpdateName}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color={colors.secondary} size="small" />
                ) : (
                  <Text style={styles.buttonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Change Password Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Security</Text>
            {!changingPassword && (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setChangingPassword(true)}
              >
                <Ionicons name="lock-closed" size={18} color={colors.primary} />
                <Text style={styles.editButtonText}>Change Password</Text>
              </TouchableOpacity>
            )}
          </View>

          {changingPassword && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Current Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.passwordInput,
                      formErrors.currentPassword && styles.inputError,
                    ]}
                    value={formData.currentPassword}
                    onChangeText={(text) => {
                      setFormData(prev => ({ ...prev, currentPassword: text }));
                      if (formErrors.currentPassword) {
                        setFormErrors(prev => ({ ...prev, currentPassword: '' }));
                      }
                    }}
                    placeholder="Enter current password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showCurrentPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    <Ionicons
                      name={showCurrentPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={colors.textLight}
                    />
                  </TouchableOpacity>
                </View>
                {formErrors.currentPassword && (
                  <Text style={styles.errorText}>{formErrors.currentPassword}</Text>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.passwordInput,
                      formErrors.newPassword && styles.inputError,
                    ]}
                    value={formData.newPassword}
                    onChangeText={(text) => {
                      setFormData(prev => ({ ...prev, newPassword: text }));
                      if (formErrors.newPassword) {
                        setFormErrors(prev => ({ ...prev, newPassword: '' }));
                      }
                    }}
                    placeholder="Enter new password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showNewPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <Ionicons
                      name={showNewPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={colors.textLight}
                    />
                  </TouchableOpacity>
                </View>
                {formErrors.newPassword && (
                  <Text style={styles.errorText}>{formErrors.newPassword}</Text>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm New Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.passwordInput,
                      formErrors.confirmPassword && styles.inputError,
                    ]}
                    value={formData.confirmPassword}
                    onChangeText={(text) => {
                      setFormData(prev => ({ ...prev, confirmPassword: text }));
                      if (formErrors.confirmPassword) {
                        setFormErrors(prev => ({ ...prev, confirmPassword: '' }));
                      }
                    }}
                    placeholder="Confirm new password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={colors.textLight}
                    />
                  </TouchableOpacity>
                </View>
                {formErrors.confirmPassword && (
                  <Text style={styles.errorText}>{formErrors.confirmPassword}</Text>
                )}
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={cancelPasswordChange}
                  disabled={updating}
                >
                  <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleChangePassword}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color={colors.secondary} size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Change Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Logout Card */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.red} />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textLight,
  },
  errorTextLarge: {
    fontSize: 16,
    color: colors.red,
    textAlign: 'center',
    marginTop: 50,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  profileDate: {
    fontSize: 12,
    color: colors.textLight,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  disabledInput: {
    backgroundColor: '#F9FAFB',
    color: colors.textLight,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  eyeButton: {
    padding: 12,
  },
  inputError: {
    borderColor: colors.red,
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: colors.red,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  buttonText: {
    color: colors.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.red,
    marginLeft: 8,
  },
});

export default ProfilePage;
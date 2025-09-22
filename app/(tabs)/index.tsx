import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');

const zoneColors = {
  red: '#EF4444',
  yellow: '#F59E0B',
  orange: '#F97316',
  lightGreen: '#10B981',
  darkGreen: '#059669',
};

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

interface LeaderboardItem {
  user_id: string;
  name: string;
  connections: number;
  rank: number;
}

interface User {
  id: string;
  name: string;
}

interface ModalFormData {
  user_id: string;
  connections: string;
  date: Date | null;
}

const HomePage: React.FC = () => {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [formData, setFormData] = useState<ModalFormData>({
    user_id: '',
    connections: '',
    date: new Date(),
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [listKey, setListKey] = useState(Date.now().toString());

  // Force re-render after modal closes
  useEffect(() => {
    if (!modalVisible) {
      console.log('Modal closed, forcing FlatList re-render');
      setListKey(Date.now().toString());
    }
  }, [modalVisible]);

  useEffect(() => {
    const checkSession = async () => {
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
          .select('is_admin, name')
          .eq('id', userId)
          .single();

        if (userError || !userData) {
          console.error('User fetch error:', userError);
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: 'Failed to load user data.',
            position: 'top',
            visibilityTime: 3000,
          });
          await AsyncStorage.removeItem('userId');
          router.replace('/auth');
          return;
        }

        setIsAdmin(userData.is_admin === true);
        fetchLeaderboard();
        fetchUsers();
      } catch (error) {
        console.error('Session check error:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Session check failed. Please log in again.',
          position: 'top',
          visibilityTime: 3000,
        });
        router.replace('/auth');
      } finally {
        setSessionLoading(false);
      }
    };

    checkSession();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data, error } = await supabase
        .from('sales')
        .select(`
          user_id, 
          connections,
          users!inner(name)
        `)
        .eq('month_year', currentMonth)
        .order('connections', { ascending: false });

      if (error) {
        console.error('Leaderboard fetch error:', error);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to load leaderboard data.',
          position: 'top',
          visibilityTime: 3000,
        });
        return;
      }

      const rankedData = (data || []).map((item: any, index: number) => ({
        user_id: item.user_id,
        name: item.users?.name || 'Unknown',
        connections: item.connections || 0,
        rank: index + 1,
      }));

      console.log('Leaderboard data fetched:', rankedData);
      setLeaderboard(rankedData);
      setListKey(Date.now().toString()); // Force re-render after data fetch
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load leaderboard data.',
        position: 'top',
        visibilityTime: 3000,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to load users.',
        position: 'top',
        visibilityTime: 3000,
      });
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setLoading(true);
    fetchLeaderboard();
  }, []);

  const getZoneColor = (connections: number): string => {
    if (connections < 5) return zoneColors.red;
    if (connections <= 10) return zoneColors.yellow;
    if (connections <= 15) return zoneColors.orange;
    if (connections <= 20) return zoneColors.lightGreen;
    return zoneColors.darkGreen;
  };

  // const getZoneName = (connections: number): string => {
  //   if (connections < 5) return 'Red Zone';
  //   if (connections <= 10) return 'Yellow Zone';
  //   if (connections <= 15) return 'Orange Zone';
  //   if (connections <= 20) return 'Light Green Zone';
  //   return 'Dark Green Zone';
  // };

  const getBarWidth = (connections: number): number => {
    const maxConnections = Math.max(...leaderboard.map(item => item.connections), 25);
    const maxWidth = width - 120;
    const minWidth = 40;
    return Math.max(minWidth, (connections / maxConnections) * maxWidth);
  };

  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!formData.user_id) {
      errors.user_id = 'Please select a sales agent';
    }

    if (!formData.connections.trim()) {
      errors.connections = 'Connections are required';
    } else {
      const connections = parseInt(formData.connections);
      if (isNaN(connections) || connections < 0) {
        errors.connections = 'Please enter a valid number (0 or greater)';
      }
    }

    if (!formData.date) {
      errors.date = 'Please select a date';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
  if (!validateForm()) return;

  setSubmitting(true);
  try {
    const currentMonth = formData.date!.toISOString().slice(0, 7);

    // Fetch existing sales record for the user and month
    const { data: existingData, error: fetchError } = await supabase
      .from('sales')
      .select('connections')
      .eq('user_id', formData.user_id)
      .eq('month_year', currentMonth)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is the code for "no rows found"
      throw fetchError;
    }

    // Calculate new connections value
    const currentConnections = existingData ? existingData.connections : 0;
    const newConnections = parseInt(formData.connections);
    const updatedConnections = currentConnections + newConnections;

    // Update or insert the sales record
    const { error } = await supabase
      .from('sales')
      .upsert({
        user_id: formData.user_id,
        connections: updatedConnections,
        month_year: currentMonth,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,month_year'
      });

    if (error) throw error;

    Toast.show({
      type: 'success',
      text1: 'Success',
      text2: 'Sales data updated successfully!',
      position: 'top',
      visibilityTime: 3000,
    });
    resetModal();
    fetchLeaderboard();
  } catch (error) {
    console.error('Error updating sales:', error);
    Toast.show({
      type: 'error',
      text1: 'Error',
      text2: 'Failed to update sales data. Please try again.',
      position: 'top',
      visibilityTime: 3000,
    });
  } finally {
    setSubmitting(false);
  }
};
  const resetModal = () => {
    setModalVisible(false);
    setShowUserPicker(false);
    setShowDatePicker(false);
    setSelectedUser(null);
    setFormData({
      user_id: '',
      connections: '',
      date: new Date(),
    });
    setFormErrors({});
    setListKey(Date.now().toString()); // Force FlatList re-render
  };

  const selectUser = (user: User) => {
    setSelectedUser(user);
    setFormData(prev => ({ ...prev, user_id: user.id }));
    setShowUserPicker(false);
    if (formErrors.user_id) {
      setFormErrors(prev => ({ ...prev, user_id: '' }));
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setFormData(prev => ({ ...prev, date: selectedDate }));
      if (formErrors.date) {
        setFormErrors(prev => ({ ...prev, date: '' }));
      }
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Select a date';
    return date.toISOString().slice(0, 10);
  };

  const renderItem = ({ item, index }: { item: LeaderboardItem; index: number }) => {
    console.log('Rendering item:', item); // Debug log
    const zoneColor = getZoneColor(item.connections);
    const isTopThree = item.rank <= 3;

    return (
      <View
        style={[
          styles.itemContainer,
          isTopThree && styles.topThreeItem,
        ]}
      >
        <View style={[styles.rankContainer, { backgroundColor: zoneColor }]}>
          <Text style={styles.rankText}>#{item.rank}</Text>
        </View>

        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.nameText} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.zoneText, { color: zoneColor }]}>
                {/* {getZoneName(item.connections)} */}
            </Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBackground}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: getBarWidth(item.connections),
                    backgroundColor: zoneColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.connectionsText}>
              {item.connections} connections
            </Text>
          </View>
        </View>

        {isTopThree && (
          <View style={styles.trophyContainer}>
            <Ionicons
              name={item.rank === 1 ? 'trophy' : item.rank === 2 ? 'medal' : 'ribbon'}
              size={24}
              color={item.rank === 1 ? '#FFD700' : item.rank === 2 ? '#C0C0C0' : '#CD7F32'}
            />
          </View>
        )}
      </View>
    );
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[
        styles.userPickerItem,
        selectedUser?.id === item.id && styles.userPickerItemSelected,
      ]}
      onPress={() => selectUser(item)}
    >
      <Text
        style={[
          styles.userPickerText,
          selectedUser?.id === item.id && styles.userPickerTextSelected,
        ]}
      >
        {item.name}
      </Text>
      {selectedUser?.id === item.id && (
        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  if (sessionLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Checking session...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <LinearGradient
        colors={[colors.primary, colors.primaryDark, colors.red, '#1F2937']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.headerContent}>
          <Text style={styles.title}>🏆 EBU Leaderboard</Text>
          <Text style={styles.subtitle}>
            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
          </Text>
          <Text style={styles.statsText}>
            {leaderboard.length} agents competing
          </Text>
        </View>
      </LinearGradient>

      <FlatList
        key={listKey}
        ListHeaderComponent={
          <View style={styles.legendContainer}>
            <Text style={styles.legendTitle}>Performance Zones</Text>
            <View style={styles.legendScroll}>
              {Object.entries(zoneColors).map(([zone, color], index) => {
                const ranges = ['<5', '5-10', '10-15', '15-20', '>20'];
                return (
                  <View key={zone} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: color }]} />
                    <Text style={styles.legendText}>{ranges[index]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        }
        data={leaderboard}
        renderItem={renderItem}
        keyExtractor={(item) => item.user_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading leaderboard...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="bar-chart-outline" size={64} color={colors.textMuted} />
              <Text style={styles.emptyText}>No sales data for this month</Text>
              <Text style={styles.emptySubText}>
                {isAdmin ? 'Add some data to get started!' : 'Check back later for updates.'}
              </Text>
            </View>
          )
        }
      />

      {isAdmin && (
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            style={styles.floatingButtonGradient}
          >
            <Ionicons name="add" size={28} color={colors.secondary} />
          </LinearGradient>
        </TouchableOpacity>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={resetModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Sales Data</Text>
              <TouchableOpacity onPress={resetModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.textLight} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Sales Agent *</Text>
                <TouchableOpacity
                  style={[styles.selectorButton, formErrors.user_id && styles.inputError]}
                  onPress={() => setShowUserPicker(!showUserPicker)}
                >
                  <Text
                    style={[
                      styles.selectorText,
                      !selectedUser && styles.placeholderText,
                    ]}
                  >
                    {selectedUser ? selectedUser.name : 'Select a sales agent'}
                  </Text>
                  <Ionicons
                    name={showUserPicker ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.textLight}
                  />
                </TouchableOpacity>
                {formErrors.user_id && (
                  <Text style={styles.errorText}>{formErrors.user_id}</Text>
                )}
                {showUserPicker && (
                  <View style={styles.userPickerContainer}>
                    <FlatList
                      data={users}
                      renderItem={renderUserItem}
                      keyExtractor={(item) => item.id}
                      style={styles.userPickerList}
                      ListHeaderComponent={<View style={styles.userPickerHeader} />}
                      ListFooterComponent={<View style={styles.userPickerFooter} />}
                    />
                  </View>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Connections *</Text>
                <TextInput
                  style={[styles.input, formErrors.connections && styles.inputError]}
                  value={formData.connections}
                  onChangeText={(text) => {
                    const numericText = text.replace(/[^0-9]/g, '');
                    setFormData((prev) => ({ ...prev, connections: numericText }));
                    if (formErrors.connections) {
                      setFormErrors((prev) => ({ ...prev, connections: '' }));
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="Enter number of connections"
                  placeholderTextColor={colors.textMuted}
                />
                {formErrors.connections && (
                  <Text style={styles.errorText}>{formErrors.connections}</Text>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Date (YYYY-MM-DD) *</Text>
                <TouchableOpacity
                  style={[styles.selectorButton, formErrors.date && styles.inputError]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text
                    style={[
                      styles.selectorText,
                      !formData.date && styles.placeholderText,
                    ]}
                  >
                    {formatDate(formData.date)}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.textLight} />
                </TouchableOpacity>
                {formErrors.date && (
                  <Text style={styles.errorText}>{formErrors.date}</Text>
                )}
                {showDatePicker && Platform.OS === 'ios' && (
                  <View style={styles.datePickerContainer}>
                    <DateTimePicker
                      value={formData.date || new Date()}
                      mode="date"
                      display="default"
                      onChange={handleDateChange}
                      style={styles.datePicker}
                    />
                  </View>
                )}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={resetModal}
                disabled={submitting}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.secondary} size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>Save Data</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={formData.date || new Date()}
          mode="date"
           minimumDate={new Date()} 
      maximumDate={new Date()} 
          display="default"
          onChange={handleDateChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
    minHeight: 140,
    zIndex: 1000,
    elevation: 12,
  },
  headerContent: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 8,
  },
  statsText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  legendContainer: {
    backgroundColor: colors.cardBg,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  legendScroll: {
    flexDirection: 'row',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textLight,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  topThreeItem: {
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  rankContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.secondary,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nameText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  zoneText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
    minWidth: 8,
  },
  connectionsText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textLight,
  },
  trophyContainer: {
    marginLeft: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 8,
    textAlign: 'center',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  floatingButtonGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.cardBg,
    borderRadius: 24,
    width: width - 40,
    height: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flex: 1,
  },
  inputContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
  },
  selectorButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    backgroundColor: colors.background,
  },
  selectorText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  placeholderText: {
    color: colors.textMuted,
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
  userPickerContainer: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    maxHeight: 200,
    marginHorizontal: 16,
  },
  userPickerList: {
    maxHeight: 200,
    borderRadius: 12,
  },
  userPickerHeader: {
    height: 8,
  },
  userPickerFooter: {
    height: 8,
  },
  userPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userPickerItemSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  userPickerText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  userPickerTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: 72,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
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
  modalButtonText: {
    color: colors.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  datePickerContainer: {
    height: 120,
    marginTop: 4,
    alignItems: 'center',
  },
  datePicker: {
    alignSelf: 'center',
  },
});

export default HomePage;
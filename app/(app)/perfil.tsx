import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';

export default function PerfilScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const initials = (user?.displayName || user?.email || '?').slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Perfil</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.displayName ?? 'Usuário'}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F5F2' },
  header: {
    padding: 20, paddingTop: 60, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E4E0DB',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1714', letterSpacing: -0.4 },
  content: { flex: 1, alignItems: 'center', padding: 40, paddingTop: 48 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#B5602A',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '600', color: '#1A1714', marginBottom: 4 },
  email: { fontSize: 14, color: '#9E9894', marginBottom: 48 },
  logoutBtn: {
    borderWidth: 1.5, borderColor: '#E4E0DB',
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32,
  },
  logoutText: { color: '#B5602A', fontWeight: '600', fontSize: 15 },
});

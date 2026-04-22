import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/(app)');
    } catch {
      setError('E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>Lista do Lar</Text>
        <Text style={styles.sub}>Da lista à sala montada.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="E-mail"
          placeholderTextColor="#9E9894"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor="#9E9894"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Entrar</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/cadastro')}>
          <Text style={styles.link}>Não tem conta? <Text style={{ color: '#B5602A' }}>Criar grátis</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F0EC' },
  inner: { flex: 1, justifyContent: 'center', padding: 28 },
  logo: { fontSize: 32, fontWeight: '700', color: '#1A1714', marginBottom: 6, letterSpacing: -0.5 },
  sub: { fontSize: 15, color: '#6B6460', marginBottom: 36 },
  error: { backgroundColor: '#FEE2E2', color: '#991B1B', padding: 12, borderRadius: 10, marginBottom: 16, fontSize: 13.5 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E4E0DB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1A1714',
    marginBottom: 12,
  },
  btn: {
    backgroundColor: '#B5602A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
    shadowColor: '#B5602A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { textAlign: 'center', color: '#6B6460', fontSize: 14 },
});

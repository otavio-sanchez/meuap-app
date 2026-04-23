import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

function getErrorMessage(code?: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Tente novamente em alguns minutos.';
    case 'auth/user-disabled':
      return 'Conta desativada. Entre em contato com o suporte.';
    case 'auth/invalid-email':
      return 'E-mail inválido.';
    default:
      return 'Erro ao entrar. Tente novamente.';
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) { setError('Preencha e-mail e senha.'); return; }
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/(app)');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setError(getErrorMessage(code));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) { setError('Digite seu e-mail para recuperar a senha.'); return; }
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/user-not-found') setError('Nenhuma conta encontrada com esse e-mail.');
      else setError('Não foi possível enviar o e-mail. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>Lista do Lar</Text>
        <Text style={styles.sub}>
          {showReset ? 'Recuperar senha' : 'Da lista à sala montada.'}
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {resetSent ? (
          <View style={styles.successBox}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>📬</Text>
            <Text style={styles.successTitle}>E-mail enviado!</Text>
            <Text style={styles.successText}>
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </Text>
            <TouchableOpacity
              style={[styles.btn, { marginTop: 20 }]}
              onPress={() => { setShowReset(false); setResetSent(false); setError(''); }}
            >
              <Text style={styles.btnText}>Voltar ao login</Text>
            </TouchableOpacity>
          </View>
        ) : showReset ? (
          <>
            <Text style={styles.resetHint}>
              Digite seu e-mail e enviaremos um link para redefinir sua senha.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="#9E9894"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <TouchableOpacity style={styles.btn} onPress={handleReset} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Enviar link de recuperação</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowReset(false); setError(''); }}>
              <Text style={styles.link}>← Voltar ao login</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
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

            <TouchableOpacity onPress={() => { setShowReset(true); setError(''); }} style={{ marginBottom: 20 }}>
              <Text style={styles.link}>Esqueci minha senha</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/cadastro')}>
              <Text style={styles.link}>
                Não tem conta? <Text style={{ color: '#B5602A' }}>Criar grátis</Text>
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F0EC' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  logo: { fontSize: 32, fontWeight: '700', color: '#1A1714', marginBottom: 6, letterSpacing: -0.5 },
  sub: { fontSize: 15, color: '#6B6460', marginBottom: 36 },
  resetHint: { fontSize: 14, color: '#6B6460', lineHeight: 20, marginBottom: 20 },
  error: {
    backgroundColor: '#FEE2E2', color: '#991B1B',
    padding: 12, borderRadius: 10, marginBottom: 16, fontSize: 13.5,
  },
  successBox: { alignItems: 'center', padding: 20 },
  successTitle: { fontSize: 18, fontWeight: '700', color: '#1A1714', marginBottom: 8 },
  successText: { fontSize: 14, color: '#6B6460', textAlign: 'center', lineHeight: 22 },
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

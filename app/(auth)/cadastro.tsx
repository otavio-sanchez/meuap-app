import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID } from '@/lib/googleAuth';

WebBrowser.maybeCompleteAuthSession();

export default function CadastroScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      setGoogleLoading(true);
      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential)
        .then(() => router.replace('/(app)'))
        .catch(err => {
          setError('Não foi possível entrar com Google. Tente novamente.');
          console.error(err);
        })
        .finally(() => setGoogleLoading(false));
    } else if (response?.type === 'error') {
      setError('Não foi possível entrar com Google. Tente novamente.');
    }
  }, [response]);

  const handleCadastro = async () => {
    setError('');
    if (!name.trim()) { setError('O nome é obrigatório.'); return; }
    if (!email.trim()) { setError('O e-mail é obrigatório.'); return; }
    if (password.length < 6) { setError('A senha deve ter ao menos 6 caracteres.'); return; }

    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(user, { displayName: name.trim() });
      router.replace('/(app)');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/email-already-in-use') setError('Esse e-mail já está cadastrado. Faça login.');
      else if (code === 'auth/invalid-email') setError('E-mail inválido.');
      else if (code === 'auth/weak-password') setError('Senha muito fraca. Use ao menos 6 caracteres.');
      else setError('Não foi possível criar a conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    await promptAsync();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>Lista do Lar</Text>
        <Text style={styles.sub}>Crie sua conta gratuita.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.googleBtn}
          onPress={handleGoogleLogin}
          disabled={!request || googleLoading}
        >
          {googleLoading
            ? <ActivityIndicator color="#1A1714" />
            : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleBtnText}>Continuar com Google</Text>
              </>
            )
          }
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou crie com e-mail</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Seu nome"
          placeholderTextColor="#9E9894"
          value={name}
          onChangeText={setName}
        />
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
          placeholder="Senha (mínimo 6 caracteres)"
          placeholderTextColor="#9E9894"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.btn} onPress={handleCadastro} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Criar conta grátis</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>
            Já tem conta? <Text style={{ color: '#B5602A' }}>Entrar</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F0EC' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 28 },
  logo: { fontSize: 32, fontWeight: '700', color: '#1A1714', marginBottom: 6, letterSpacing: -0.5 },
  sub: { fontSize: 15, color: '#6B6460', marginBottom: 28 },
  error: {
    backgroundColor: '#FEE2E2', color: '#991B1B',
    padding: 12, borderRadius: 10, marginBottom: 16, fontSize: 13.5,
  },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E4E0DB',
    borderRadius: 12, padding: 14, marginBottom: 20,
  },
  googleIcon: { fontSize: 16, fontWeight: '700', color: '#4285F4' },
  googleBtnText: { fontSize: 15, fontWeight: '500', color: '#1A1714' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E4E0DB' },
  dividerText: { fontSize: 13, color: '#9E9894' },
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

import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signOut, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';
import { watchProperties } from '@/lib/firebase/firestore';
import { Property, PROPERTY_TYPES } from '@/lib/types';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

export default function PerfilScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [name, setName] = useState(user?.displayName ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    return watchProperties(user.uid, setProperties);
  }, [user?.uid]);

  const initial = (user?.displayName || user?.email || '?').slice(0, 2).toUpperCase();

  const createdAt = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : null;

  const handleSave = async () => {
    if (!name.trim() || !auth.currentUser) return;
    setSaving(true);
    try {
      await updateProfile(auth.currentUser, { displayName: name.trim() });
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/(auth)/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F5F2' }}>
      <View style={s.header}>
        <Text style={s.title}>Perfil</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* Avatar + info */}
        <View style={[s.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>

          {editing ? (
            <View style={{ width: '100%', marginTop: 16 }}>
              <Text style={s.label}>Nome de exibição</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="Seu nome"
                placeholderTextColor="#9E9894"
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  style={[s.btn, { flex: 1, backgroundColor: '#F0EDE9' }]}
                  onPress={() => { setEditing(false); setName(user?.displayName ?? ''); }}
                >
                  <Text style={[s.btnText, { color: '#1A1714' }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <Text style={s.name}>{user?.displayName ?? 'Usuário'}</Text>
              <Text style={s.email}>{user?.email}</Text>
              {createdAt && <Text style={s.since}>Membro desde {createdAt}</Text>}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[s.btn, { paddingHorizontal: 24, paddingVertical: 10 }]}
                  onPress={() => setEditing(true)}
                >
                  <Text style={s.btnText}>✎ Editar nome</Text>
                </TouchableOpacity>
                {saved && <Text style={{ fontSize: 13, color: '#5B8A72', fontWeight: '500' }}>✓ Salvo!</Text>}
              </View>
            </>
          )}
        </View>

        {/* Properties */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={s.sectionTitle}>Meus imóveis ({properties.length})</Text>
            <TouchableOpacity onPress={() => router.push('/novo-imovel')}>
              <Text style={{ fontSize: 13, color: '#B5602A', fontWeight: '500' }}>+ Novo</Text>
            </TouchableOpacity>
          </View>

          {properties.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#9E9894', paddingVertical: 20, fontSize: 14 }}>
              Nenhum imóvel cadastrado.
            </Text>
          ) : properties.map((p, idx) => (
            <TouchableOpacity
              key={p.id}
              style={[s.propertyRow, idx < properties.length - 1 && s.propertyRowBorder]}
              onPress={() => router.push(`/imovel/${p.id}`)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20, width: 30, textAlign: 'center' }}>🏠</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#1A1714' }} numberOfLines={1}>{p.name}</Text>
                <Text style={{ fontSize: 12, color: '#9E9894', marginTop: 2 }}>
                  {PROPERTY_TYPES[p.type]}{p.area > 0 ? ` · ${p.area}m²` : ''}
                  {p.totalBudget > 0 ? ` · ${fmt(p.totalBudget)}` : ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.badge, { backgroundColor: p.isPublic ? '#DCFCE7' : '#F0EDE9' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '500', color: p.isPublic ? '#166534' : '#6B6460' }}>
                    {p.isPublic ? 'Público' : 'Privado'}
                  </Text>
                </View>
                <Text style={{ color: '#C9C4BF', fontSize: 18 }}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Email (read-only) */}
        <View style={[s.card, { marginBottom: 8 }]}>
          <Text style={s.label}>E-mail</Text>
          <Text style={{ fontSize: 15, color: '#6B6460' }}>{user?.email}</Text>
          <Text style={{ fontSize: 12, color: '#9E9894', marginTop: 4 }}>O e-mail não pode ser alterado.</Text>
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    padding: 20, paddingTop: 60, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E4E0DB',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1714', letterSpacing: -0.4 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#E4E0DB',
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#C97B2E',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '600', color: '#1A1714', marginTop: 12, marginBottom: 4 },
  email: { fontSize: 14, color: '#9E9894' },
  since: { fontSize: 12, color: '#C9C4BF', marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1A1714' },
  propertyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
  },
  propertyRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0EDE9' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#6B6460', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: {
    backgroundColor: '#F7F5F2', borderWidth: 1.5, borderColor: '#E4E0DB',
    borderRadius: 10, padding: 12, fontSize: 14, color: '#1A1714',
  },
  btn: { backgroundColor: '#B5602A', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  logoutBtn: {
    borderWidth: 1.5, borderColor: '#E4E0DB',
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32,
    alignItems: 'center',
  },
  logoutText: { color: '#B5602A', fontWeight: '600', fontSize: 15 },
});

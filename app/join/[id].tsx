import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getPropertyById, joinProperty } from '@/lib/firebase/firestore';
import { Property, PROPERTY_TYPES } from '@/lib/types';

export default function JoinPropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const prop = await getPropertyById(id);
        if (!prop) { setNotFound(true); return; }
        if (!prop.inviteEnabled) { setNotFound(true); return; }
        setProperty(prop);
        if (user && (prop.memberUids ?? []).includes(user.uid)) {
          setAlreadyMember(true);
        }
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) load();
  }, [id, user, authLoading]);

  const handleJoin = async () => {
    if (!user) {
      // Save the destination and go to login
      router.push({ pathname: '/(auth)/login', params: { redirect: `/join/${id}` } });
      return;
    }
    if (!property) return;
    setJoining(true);
    try {
      await joinProperty(id, { uid: user.uid, email: user.email, displayName: user.displayName });
      router.replace(`/imovel/${id}`);
    } catch (err: any) {
      Alert.alert('Erro', err?.message ?? 'Não foi possível entrar no projeto.');
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || loading) {
    return <View style={s.center}><ActivityIndicator color="#B5602A" size="large" /></View>;
  }

  if (notFound || !property) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🔒</Text>
        <Text style={s.bigTitle}>Convite inválido</Text>
        <Text style={s.sub}>Este link pode ter expirado ou sido desativado pelo dono.</Text>
        <TouchableOpacity style={s.btn} onPress={() => router.replace('/(app)')}>
          <Text style={s.btnText}>Ir para o início</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (alreadyMember) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>✓</Text>
        <Text style={s.bigTitle}>Você já é membro</Text>
        <Text style={s.sub}>Você já faz parte do projeto "{property.name}".</Text>
        <TouchableOpacity style={s.btn} onPress={() => router.replace(`/imovel/${id}`)}>
          <Text style={s.btnText}>Abrir projeto</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ownerMember = (property.members ?? []).find(m => m.role === 'owner');
  const ownerName = ownerMember?.displayName || ownerMember?.email || 'Alguém';

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')}>
          <Text style={s.back}>←</Text>
        </TouchableOpacity>
      </View>

      <View style={s.body}>
        {/* Invite card */}
        <View style={s.card}>
          <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>🏠</Text>
          <Text style={s.inviteLabel}>Você foi convidado para colaborar</Text>
          <Text style={s.propertyName}>{property.name}</Text>
          <Text style={s.propertyMeta}>
            {PROPERTY_TYPES[property.type]}
            {property.area > 0 ? ` · ${property.area}m²` : ''}
          </Text>
          {property.address ? (
            <Text style={s.propertyAddress} numberOfLines={1}>📍 {property.address}</Text>
          ) : null}

          <View style={s.divider} />

          <View style={s.ownerRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{ownerName.slice(0, 2).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={s.ownerLabel}>Convidado por</Text>
              <Text style={s.ownerName}>{ownerName}</Text>
            </View>
          </View>

          <View style={s.roleInfo}>
            <Text style={s.roleInfoText}>
              Você vai entrar como <Text style={{ fontWeight: '700' }}>editor</Text> — pode adicionar e editar itens, mas não excluir o projeto.
            </Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity style={s.joinBtn} onPress={handleJoin} disabled={joining}>
          {joining
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.joinBtnText}>
                {user ? 'Entrar no projeto' : 'Criar conta e entrar'}
              </Text>
          }
        </TouchableOpacity>

        {!user && (
          <TouchableOpacity style={s.loginLink} onPress={() => router.push({ pathname: '/(auth)/login', params: { redirect: `/join/${id}` } })}>
            <Text style={s.loginLinkText}>Já tenho conta — fazer login</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => router.replace('/(app)')} style={{ marginTop: 10 }}>
          <Text style={s.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F5F2' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F5F2', padding: 32, gap: 10 },
  bigTitle: { fontSize: 20, fontWeight: '700', color: '#1A1714', textAlign: 'center' },
  sub: { fontSize: 14, color: '#9E9894', textAlign: 'center', lineHeight: 20 },
  header: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#E4E0DB',
  },
  back: { fontSize: 20, color: '#6B6460' },
  body: { flex: 1, padding: 20, justifyContent: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: '#E4E0DB', marginBottom: 16,
    shadowColor: '#1A1714', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  inviteLabel: { fontSize: 13, color: '#9E9894', textAlign: 'center', marginBottom: 8 },
  propertyName: { fontSize: 22, fontWeight: '700', color: '#1A1714', textAlign: 'center', marginBottom: 4 },
  propertyMeta: { fontSize: 13, color: '#9E9894', textAlign: 'center' },
  propertyAddress: { fontSize: 13, color: '#6B6460', textAlign: 'center', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#F0EDE9', marginVertical: 20 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F0EDE9', justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#6B6460' },
  ownerLabel: { fontSize: 11, color: '#9E9894', marginBottom: 2 },
  ownerName: { fontSize: 14, fontWeight: '600', color: '#1A1714' },
  roleInfo: { backgroundColor: '#F7F5F2', borderRadius: 10, padding: 12 },
  roleInfoText: { fontSize: 13, color: '#6B6460', lineHeight: 19 },
  joinBtn: {
    backgroundColor: '#B5602A', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 10,
  },
  joinBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginLink: {
    borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginBottom: 6,
  },
  loginLinkText: { color: '#1A1714', fontSize: 14, fontWeight: '600' },
  cancelText: { textAlign: 'center', fontSize: 13, color: '#9E9894' },
  btn: { backgroundColor: '#B5602A', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

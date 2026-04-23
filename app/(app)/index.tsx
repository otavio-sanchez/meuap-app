import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, useWindowDimensions, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { watchProperties, deleteProperty } from '@/lib/firebase/firestore';
import { Property, PROPERTY_TYPES } from '@/lib/types';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

function greeting(name?: string | null) {
  const h = new Date().getHours();
  const salut = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  return name ? `${salut}, ${name.split(' ')[0]}! 👋` : `${salut}! 👋`;
}

const TYPE_ICONS: Record<string, string> = {
  apartamento: '🏢', casa: '🏡', kitnet: '🏠',
  cobertura: '🏙️', studio: '🛋️', outros: '🏠',
};

export default function ImoveisScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const numColumns = width >= 600 ? 2 : 1;
  const pad = width >= 600 ? 20 : 16;

  useEffect(() => {
    if (!user) return;
    return watchProperties(user.uid, data => {
      setProperties(data);
      setLoading(false);
    });
  }, [user]);

  const handleDelete = (p: Property) => {
    Alert.alert(
      'Excluir imóvel',
      `Excluir "${p.name}"? Todos os cômodos e itens serão removidos permanentemente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sim, excluir', style: 'destructive', onPress: () => deleteProperty(p.id) },
      ]
    );
  };

  if (loading) {
    return <View style={st.center}><ActivityIndicator color="#B5602A" size="large" /></View>;
  }

  const cardWidth = numColumns === 2
    ? (width - pad * 2 - 12) / 2
    : undefined;

  return (
    <View style={st.container}>
      <View style={st.header}>
        <View style={{ flex: 1 }}>
          <Text style={st.greeting}>{greeting(user?.displayName)}</Text>
          <Text style={st.greetingSub}>
            {properties.length === 0
              ? 'Crie seu primeiro imóvel para começar.'
              : `Você tem ${properties.length} imóvel${properties.length > 1 ? 'is' : ''} cadastrado${properties.length > 1 ? 's' : ''}.`}
          </Text>
        </View>
        <TouchableOpacity style={st.addBtn} onPress={() => router.push('/novo-imovel')}>
          <Text style={st.addBtnText}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      {properties.length === 0 ? (
        <View style={st.empty}>
          <Text style={st.emptyIcon}>🏠</Text>
          <Text style={st.emptyTitle}>Seu primeiro ninho</Text>
          <Text style={st.emptyText}>
            Cadastre seu apartamento ou casa e comece a planejar cada cômodo com clareza e organização.
          </Text>
          <TouchableOpacity style={st.btn} onPress={() => router.push('/novo-imovel')}>
            <Text style={st.btnText}>Criar meu primeiro imóvel →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={i => i.id}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={{ padding: pad, gap: 12, paddingBottom: 40 }}
          columnWrapperStyle={numColumns === 2 ? { gap: 12 } : undefined}
          renderItem={({ item: p }) => (
            <TouchableOpacity
              style={[st.card, cardWidth ? { width: cardWidth } : null]}
              onPress={() => router.push(`/imovel/${p.id}`)}
              activeOpacity={0.75}
            >
              {/* Cover area */}
              <View style={st.cover}>
                <Text style={st.coverIcon}>{TYPE_ICONS[p.type] ?? '🏠'}</Text>
                {/* Public/private badge */}
                <View style={[st.publicBadge, p.isPublic && st.publicBadgeOn]}>
                  <Text style={[st.publicBadgeText, p.isPublic && st.publicBadgeTextOn]}>
                    {p.isPublic ? 'Público' : 'Privado'}
                  </Text>
                </View>
              </View>

              {/* Card body */}
              <View style={st.cardBody}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <Text style={st.cardName} numberOfLines={1}>{p.name}</Text>
                </View>
                <Text style={st.cardMeta}>
                  {PROPERTY_TYPES[p.type]}{p.area > 0 ? ` · ${p.area}m²` : ''}
                </Text>

                {p.totalBudget > 0 && (
                  <View style={st.budgetBadge}>
                    <Text style={st.budgetText}>Orçamento <Text style={{ fontWeight: '700', color: '#1A1714' }}>{fmt(p.totalBudget)}</Text></Text>
                  </View>
                )}

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <TouchableOpacity
                    style={st.openBtn}
                    onPress={() => router.push(`/imovel/${p.id}`)}
                  >
                    <Text style={st.openBtnText}>Abrir →</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={st.deleteBtn}
                    onPress={() => handleDelete(p)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={st.deleteBtnText}>🗑</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F5F2' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F5F2' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E4E0DB',
    gap: 12,
  },
  greeting: { fontSize: 20, fontWeight: '700', color: '#1A1714', letterSpacing: -0.3 },
  greetingSub: { fontSize: 13, color: '#9E9894', marginTop: 2 },
  addBtn: { backgroundColor: '#B5602A', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, flexShrink: 0 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#1A1714', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B6460', textAlign: 'center', lineHeight: 22, marginBottom: 28, maxWidth: 300 },
  btn: {
    backgroundColor: '#B5602A', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14,
    shadowColor: '#B5602A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#E4E0DB', overflow: 'hidden',
    shadowColor: '#1A1714', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cover: {
    height: 100, backgroundColor: '#F0EDE9',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  coverIcon: { fontSize: 40 },
  publicBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#F0EDE9', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#E4E0DB',
  },
  publicBadgeOn: { backgroundColor: 'rgba(22,101,52,0.1)', borderColor: 'rgba(22,101,52,0.2)' },
  publicBadgeText: { fontSize: 10, fontWeight: '500', color: '#9E9894' },
  publicBadgeTextOn: { color: '#166534' },
  cardBody: { padding: 14 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1A1714', flex: 1 },
  cardMeta: { fontSize: 12, color: '#9E9894', marginBottom: 4 },
  budgetBadge: {
    backgroundColor: '#F7F5F2', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, marginTop: 6,
  },
  budgetText: { fontSize: 12, color: '#6B6460' },
  openBtn: {
    flex: 1, backgroundColor: '#B5602A', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  openBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  deleteBtn: {
    backgroundColor: '#FFF5F5', borderRadius: 8, borderWidth: 1, borderColor: '#FECACA',
    paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtnText: { fontSize: 16 },
});

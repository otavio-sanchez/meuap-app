import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/context/AuthContext';

interface Property {
  id: string;
  name: string;
  type: string;
  area: number;
  description?: string;
}

const TYPES: Record<string, string> = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  kitnet: 'Kitnet',
  outros: 'Outros',
};

const TYPE_ICONS: Record<string, string> = {
  apartamento: '🏢',
  casa: '🏠',
  kitnet: '🛏',
  outros: '📦',
};

export default function ImoveisScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const numColumns = width >= 600 ? 2 : 1;
  const horizontalPad = width >= 600 ? 20 : 16;

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'properties'), where('memberUids', 'array-contains', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() } as Property)));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#B5602A" size="large" />
      </View>
    );
  }

  const cardWidth = numColumns === 2
    ? (width - horizontalPad * 2 - 12) / 2
    : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meus Imóveis</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/novo-imovel')}>
          <Text style={styles.addBtnText}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      {properties.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🏠</Text>
          <Text style={styles.emptyTitle}>Nenhum imóvel ainda</Text>
          <Text style={styles.emptyText}>Crie seu primeiro imóvel para começar a planejar.</Text>
          <TouchableOpacity style={styles.btn} onPress={() => router.push('/novo-imovel')}>
            <Text style={styles.btnText}>Criar imóvel →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={i => i.id}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={{ padding: horizontalPad, gap: 12 }}
          columnWrapperStyle={numColumns === 2 ? { gap: 12 } : undefined}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, cardWidth ? { width: cardWidth } : null]}
              onPress={() => router.push(`/imovel/${item.id}`)}
              activeOpacity={0.75}
            >
              <View style={styles.cardTop}>
                <View style={styles.iconBadge}>
                  <Text style={styles.iconBadgeText}>
                    {TYPE_ICONS[item.type] ?? '🏠'}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>

              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>

              <View style={styles.cardMeta}>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>
                    {TYPES[item.type] ?? item.type}
                  </Text>
                </View>
                {item.area > 0 && (
                  <Text style={styles.cardArea}>{item.area} m²</Text>
                )}
              </View>

              {item.description ? (
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F5F2' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F5F2' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E4E0DB',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1714', letterSpacing: -0.4 },
  addBtn: {
    backgroundColor: '#B5602A', borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#1A1714', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B6460', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  btn: {
    backgroundColor: '#B5602A', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14,
    shadowColor: '#B5602A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  card: {
    flex: 1,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#E4E0DB',
    shadowColor: '#1A1714', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconBadge: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#FDF3EC',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBadgeText: { fontSize: 20 },
  chevron: { fontSize: 22, color: '#C9C4BF', fontWeight: '300' },
  cardName: { fontSize: 16, fontWeight: '700', color: '#1A1714', marginBottom: 8, letterSpacing: -0.2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  typePill: {
    backgroundColor: '#F0EDE9', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  typePillText: { fontSize: 12, fontWeight: '500', color: '#6B6460' },
  cardArea: { fontSize: 12, color: '#9E9894' },
  cardDesc: { fontSize: 13, color: '#6B6460', lineHeight: 18, marginTop: 2 },
});

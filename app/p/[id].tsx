import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getPropertyById, getRoomsForProperty, getItemsForProperty } from '@/lib/firebase/firestore';
import {
  Property, FirestoreRoom, FirestoreItem,
  CATEGORIES, STATUS_CONFIG, PROPERTY_TYPES, ItemStatus, ItemCategory,
} from '@/lib/types';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

export default function PublicPropertyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<FirestoreRoom[]>([]);
  const [items, setItems] = useState<FirestoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const prop = await getPropertyById(id);
        if (!prop || !prop.isPublic) { setNotFound(true); return; }
        const [r, it] = await Promise.all([
          getRoomsForProperty(id),
          getItemsForProperty(id),
        ]);
        setProperty(prop);
        setRooms(r);
        setItems(it);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#B5602A" size="large" /></View>;
  }

  if (notFound || !property) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🔒</Text>
        <Text style={s.notFoundTitle}>Projeto não encontrado</Text>
        <Text style={s.notFoundSub}>Este link pode ser privado ou inválido.</Text>
        <TouchableOpacity style={s.ctaBtn} onPress={() => router.replace('/(app)')}>
          <Text style={s.ctaBtnText}>Ir para o início</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalEstimated = items.reduce((sum, i) => sum + i.estimatedPrice, 0);
  const totalPaid = items.reduce((sum, i) => sum + (i.paidPrice ?? 0), 0);
  const installed = items.filter(i => i.status === 'instalado').length;
  const completionPct = items.length > 0 ? Math.round((installed / items.length) * 100) : 0;

  const categoryTotals = (Object.keys(CATEGORIES) as ItemCategory[])
    .map(cat => ({
      cat, ...CATEGORIES[cat],
      total: items.filter(i => i.category === cat).reduce((acc, i) => acc + i.estimatedPrice, 0),
      count: items.filter(i => i.category === cat).length,
    }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.total - a.total);

  const isAlreadyMember = user && (property.memberUids ?? []).includes(user.uid);

  const handleShare = () =>
    Share.share({ message: `Veja o projeto "${property.name}": https://meuap.app/p/${id}` });

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F5F2' }}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)')}>
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
          <View style={s.publicBadge}>
            <Text style={s.publicBadgeText}>🌐 Público</Text>
          </View>
          <TouchableOpacity onPress={handleShare} style={s.shareBtn}>
            <Text style={s.shareBtnText}>🔗</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.title} numberOfLines={2}>{property.name}</Text>
        <Text style={s.sub}>
          {PROPERTY_TYPES[property.type]}
          {property.area > 0 ? ` · ${property.area}m²` : ''}
          {rooms.length > 0 ? ` · ${rooms.length} cômodo${rooms.length !== 1 ? 's' : ''}` : ''}
        </Text>
        {property.address ? (
          <Text style={s.address} numberOfLines={1}>📍 {property.address}</Text>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {/* CTA — join or open app */}
        {isAlreadyMember ? (
          <TouchableOpacity style={s.ctaBanner} onPress={() => router.push(`/imovel/${id}`)}>
            <Text style={s.ctaBannerText}>✓ Você já é membro — abrir projeto →</Text>
          </TouchableOpacity>
        ) : property.inviteEnabled ? (
          <TouchableOpacity
            style={s.ctaBanner}
            onPress={() => router.push(`/join/${id}`)}
          >
            <Text style={s.ctaBannerText}>
              {user ? '+ Entrar neste projeto →' : '+ Criar conta e entrar →'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Progress */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View>
              <Text style={s.cardLabel}>Progresso da montagem</Text>
              <Text style={s.bigNum}>{completionPct}% concluído</Text>
            </View>
            <Text style={{ fontSize: 40 }}>{completionPct === 100 ? '🎉' : completionPct >= 50 ? '🔨' : '📦'}</Text>
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${completionPct}%` as any, backgroundColor: completionPct === 100 ? '#5B8A72' : '#B5602A' }]} />
          </View>
          <Text style={s.grayText}>{installed} de {items.length} itens instalados</Text>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          {property.totalBudget > 0 && (
            <View style={[s.stat, { flex: 1 }]}>
              <Text style={s.statLabel}>Orçamento</Text>
              <Text style={s.statVal}>{fmt(property.totalBudget)}</Text>
            </View>
          )}
          <View style={[s.stat, { flex: 1 }]}>
            <Text style={s.statLabel}>Estimado</Text>
            <Text style={[s.statVal, { color: '#B5602A' }]}>{fmt(totalEstimated)}</Text>
          </View>
          <View style={[s.stat, { flex: 1 }]}>
            <Text style={s.statLabel}>Pago</Text>
            <Text style={[s.statVal, { color: '#5B8A72' }]}>{fmt(totalPaid)}</Text>
          </View>
        </View>

        {/* Status summary */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Por status</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(STATUS_CONFIG) as ItemStatus[]).map(status => {
              const cfg = STATUS_CONFIG[status];
              const count = items.filter(i => i.status === status).length;
              return (
                <View key={status} style={[s.statusPill, { backgroundColor: cfg.bg }]}>
                  <View style={[s.dot, { backgroundColor: cfg.dot }]} />
                  <Text style={[s.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  <Text style={[s.statusCount, { color: cfg.color }]}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Rooms */}
        {rooms.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Cômodos</Text>
            {rooms.map(room => {
              const roomItems = items.filter(i => i.roomId === room.id);
              const roomTotal = roomItems.reduce((acc, i) => acc + i.estimatedPrice, 0);
              const roomInstalled = roomItems.filter(i => i.status === 'instalado').length;
              const pct = roomItems.length > 0 ? (roomInstalled / roomItems.length) * 100 : 0;
              return (
                <View key={room.id} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <View style={[s.roomIcon, { backgroundColor: room.color + '18', borderColor: room.color + '30' }]}>
                      <Text style={{ fontSize: 16 }}>{room.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '500', color: '#1A1714' }}>{room.name}</Text>
                        <Text style={{ fontSize: 12, color: '#6B6460' }}>{fmt(roomTotal)}</Text>
                      </View>
                      <View style={s.progressBar}>
                        <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: room.color }]} />
                      </View>
                    </View>
                  </View>
                  {/* Items in this room */}
                  {roomItems.length > 0 && (
                    <View style={{ marginLeft: 42, gap: 4 }}>
                      {roomItems.map(item => {
                        const cfg = STATUS_CONFIG[item.status];
                        return (
                          <View key={item.id} style={s.itemRow}>
                            <View style={[s.dot, { backgroundColor: cfg.dot, marginTop: 1 }]} />
                            <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                            {item.estimatedPrice > 0 && (
                              <Text style={s.itemPrice}>{fmt(item.estimatedPrice)}</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Categories */}
        {categoryTotals.length > 0 && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Por categoria</Text>
            {categoryTotals.map(c => (
              <View key={c.cat} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c.color }} />
                    <Text style={{ fontSize: 13, color: '#1A1714' }}>{c.label}</Text>
                    <Text style={{ fontSize: 11, color: '#9E9894' }}>({c.count})</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '500' }}>{fmt(c.total)}</Text>
                </View>
                <View style={s.progressBar}>
                  <View style={[s.progressFill, { width: `${totalEstimated > 0 ? (c.total / totalEstimated) * 100 : 0}%` as any, backgroundColor: c.color }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Bottom CTA */}
        {!user && (
          <View style={s.bottomCta}>
            <Text style={s.bottomCtaTitle}>Organize seu apartamento</Text>
            <Text style={s.bottomCtaSub}>Crie sua lista de compras, controle o orçamento e planeje sua mudança.</Text>
            <TouchableOpacity style={s.ctaBtn} onPress={() => router.push('/(auth)/cadastro')}>
              <Text style={s.ctaBtnText}>Criar conta grátis</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F5F2', padding: 24 },
  notFoundTitle: { fontSize: 18, fontWeight: '700', color: '#1A1714', marginBottom: 8 },
  notFoundSub: { fontSize: 14, color: '#9E9894', textAlign: 'center', marginBottom: 24 },
  header: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#E4E0DB',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  back: { fontSize: 20, color: '#6B6460', marginRight: 10 },
  publicBadge: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
  },
  publicBadgeText: { fontSize: 12, color: '#5B8A72', fontWeight: '600', backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  shareBtn: { padding: 6 },
  shareBtnText: { fontSize: 18 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1714', letterSpacing: -0.4, marginBottom: 4 },
  sub: { fontSize: 13, color: '#9E9894', marginBottom: 2 },
  address: { fontSize: 13, color: '#6B6460', marginTop: 2 },
  body: { padding: 16, paddingBottom: 48 },
  ctaBanner: {
    backgroundColor: '#B5602A', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 14,
  },
  ctaBannerText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#E4E0DB',
    shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardLabel: { fontSize: 12, color: '#9E9894', marginBottom: 4 },
  bigNum: { fontSize: 24, fontWeight: '700', color: '#1A1714' },
  progressBar: { height: 6, backgroundColor: '#F0EDE9', borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#B5602A' },
  grayText: { fontSize: 13, color: '#9E9894', marginTop: 6 },
  stat: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E4E0DB' },
  statLabel: { fontSize: 11, color: '#9E9894', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  statVal: { fontSize: 16, fontWeight: '700', color: '#1A1714' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1A1714', marginBottom: 12 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 12, fontWeight: '500' },
  statusCount: { fontSize: 12, fontWeight: '700' },
  roomIcon: { width: 32, height: 32, borderRadius: 7, borderWidth: 1, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingVertical: 3 },
  itemName: { flex: 1, fontSize: 12, color: '#4B4540' },
  itemPrice: { fontSize: 12, color: '#6B6460', fontWeight: '500' },
  bottomCta: {
    backgroundColor: '#fff', borderRadius: 14, padding: 20, marginTop: 6,
    borderWidth: 1, borderColor: '#E4E0DB', alignItems: 'center',
  },
  bottomCtaTitle: { fontSize: 16, fontWeight: '700', color: '#1A1714', marginBottom: 6 },
  bottomCtaSub: { fontSize: 13, color: '#9E9894', textAlign: 'center', marginBottom: 16 },
  ctaBtn: { backgroundColor: '#B5602A', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  watchProperty, watchRooms, watchItems,
  updateProperty, deleteProperty,
} from '@/lib/firebase/firestore';
import { Property, FirestoreRoom, FirestoreItem, CATEGORIES, STATUS_CONFIG, PROPERTY_TYPES, ItemStatus, ItemCategory } from '@/lib/types';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

export default function ImovelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<FirestoreRoom[]>([]);
  const [items, setItems] = useState<FirestoreItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub1 = watchProperty(id, p => { setProperty(p); setLoading(false); });
    const unsub2 = watchRooms(id, setRooms);
    const unsub3 = watchItems(id, setItems);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [id]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#B5602A" size="large" /></View>;
  }
  if (!property) {
    return <View style={s.center}><Text style={s.grayText}>Imóvel não encontrado.</Text></View>;
  }

  const totalEstimated = items.reduce((sum, i) => sum + i.estimatedPrice, 0);
  const totalPaid = items.reduce((sum, i) => sum + (i.paidPrice ?? 0), 0);
  const installed = items.filter(i => i.status === 'instalado').length;
  const completionPct = items.length > 0 ? Math.round((installed / items.length) * 100) : 0;
  const remaining = (property.totalBudget || 0) - totalEstimated;

  const categoryTotals = (Object.keys(CATEGORIES) as ItemCategory[])
    .map(cat => ({
      cat, ...CATEGORIES[cat],
      total: items.filter(i => i.category === cat).reduce((s, i) => s + i.estimatedPrice, 0),
      count: items.filter(i => i.category === cat).length,
    }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.total - a.total);

  const handleDelete = () => {
    Alert.alert('Excluir imóvel', `Tem certeza que deseja excluir "${property.name}"? Esta ação não pode ser desfeita.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          await deleteProperty(id);
          router.replace('/(app)');
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F5F2' }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← Imóveis</Text>
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{property.name}</Text>
        <Text style={s.sub}>
          {PROPERTY_TYPES[property.type]}{property.area > 0 ? ` · ${property.area}m²` : ''}{rooms.length > 0 ? ` · ${rooms.length} cômodo${rooms.length !== 1 ? 's' : ''}` : ''}
        </Text>
        {property.address ? <Text style={s.address} numberOfLines={1}>📍 {property.address}</Text> : null}
      </View>

      <ScrollView contentContainerStyle={s.body}>
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
            <View style={[s.progressFill, {
              width: `${completionPct}%` as any,
              backgroundColor: completionPct === 100 ? '#5B8A72' : '#B5602A',
            }]} />
          </View>
          <Text style={[s.grayText, { marginTop: 6 }]}>{installed} de {items.length} itens instalados</Text>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <View style={[s.stat, { flex: 1 }]}>
            <Text style={s.statLabel}>Orçamento</Text>
            <Text style={s.statVal}>{fmt(property.totalBudget || 0)}</Text>
          </View>
          <View style={[s.stat, { flex: 1 }]}>
            <Text style={s.statLabel}>Estimado</Text>
            <Text style={[s.statVal, { color: '#B5602A' }]}>{fmt(totalEstimated)}</Text>
          </View>
          <View style={[s.stat, { flex: 1 }]}>
            <Text style={s.statLabel}>Pago</Text>
            <Text style={[s.statVal, { color: '#5B8A72' }]}>{fmt(totalPaid)}</Text>
          </View>
        </View>

        {remaining < 0 && (
          <View style={s.alert}>
            <Text style={s.alertText}>⚠️ Orçamento excedido em {fmt(Math.abs(remaining))}</Text>
          </View>
        )}

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
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={s.sectionTitle}>Cômodos</Text>
            <TouchableOpacity onPress={() => router.push(`/imovel/${id}/comodos`)}>
              <Text style={s.link}>Ver todos →</Text>
            </TouchableOpacity>
          </View>
          {rooms.length === 0 ? (
            <Text style={[s.grayText, { textAlign: 'center', paddingVertical: 12 }]}>Nenhum cômodo ainda.</Text>
          ) : rooms.map(room => {
            const roomItems = items.filter(i => i.roomId === room.id);
            const roomTotal = roomItems.reduce((s, i) => s + i.estimatedPrice, 0);
            const roomInstalled = roomItems.filter(i => i.status === 'instalado').length;
            const pct = roomItems.length > 0 ? (roomInstalled / roomItems.length) * 100 : 0;
            return (
              <View key={room.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
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
            );
          })}
        </View>

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
                  <View style={[s.progressFill, {
                    width: `${totalEstimated > 0 ? (c.total / totalEstimated) * 100 : 0}%` as any,
                    backgroundColor: c.color,
                  }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Navigation buttons */}
        <View style={s.navGrid}>
          {[
            { label: '🛋️ Cômodos', path: `/imovel/${id}/comodos` },
            { label: '💰 Orçamento', path: `/imovel/${id}/orcamento` },
            { label: '🚛 Mudança', path: `/imovel/${id}/mudanca` },
          ].map(nav => (
            <TouchableOpacity key={nav.path} style={s.navBtn} onPress={() => router.push(nav.path)}>
              <Text style={s.navBtnText}>{nav.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Delete */}
        <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
          <Text style={s.deleteBtnText}>Excluir imóvel</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F5F2' },
  header: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#E4E0DB',
  },
  back: { fontSize: 14, color: '#6B6460', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '700', color: '#1A1714', letterSpacing: -0.4 },
  sub: { fontSize: 13, color: '#9E9894', marginTop: 2 },
  address: { fontSize: 13, color: '#6B6460', marginTop: 4 },
  body: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#E4E0DB',
    shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardLabel: { fontSize: 12, color: '#9E9894', marginBottom: 4 },
  bigNum: { fontSize: 24, fontWeight: '700', color: '#1A1714' },
  progressBar: { height: 6, backgroundColor: '#F0EDE9', borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#B5602A' },
  grayText: { fontSize: 13, color: '#9E9894' },
  stat: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#E4E0DB',
  },
  statLabel: { fontSize: 11, color: '#9E9894', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  statVal: { fontSize: 16, fontWeight: '700', color: '#1A1714' },
  alert: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 14 },
  alertText: { fontSize: 13, color: '#991B1B', fontWeight: '500' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1A1714' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 12, fontWeight: '500' },
  statusCount: { fontSize: 12, fontWeight: '700' },
  roomIcon: { width: 32, height: 32, borderRadius: 7, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  link: { fontSize: 13, color: '#B5602A', fontWeight: '500' },
  navGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  navBtn: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#E4E0DB',
  },
  navBtnText: { fontSize: 12, fontWeight: '600', color: '#1A1714', textAlign: 'center' },
  deleteBtn: {
    borderWidth: 1.5, borderColor: '#FECACA', borderRadius: 12,
    padding: 14, alignItems: 'center', backgroundColor: '#FFF5F5',
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
});

import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  watchProperty, watchRooms, watchItems,
  createItem, updateItem, deleteItem, deleteRoom, updateRoom,
} from '@/lib/firebase/firestore';
import {
  Property, FirestoreRoom, FirestoreItem, ItemStatus, ItemPriority, ItemCategory,
  STATUS_CONFIG, STATUS_ORDER, PRIORITY_CONFIG, CATEGORIES, ROOM_SUGGESTIONS as RS,
} from '@/lib/types';
// ItemRow and ItemFormModal imported from components
import { ItemRow } from '@/components/ItemRow';
import { ItemFormModal } from '@/components/ItemFormModal';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

export default function ComodoScreen() {
  const { id, roomId } = useLocalSearchParams<{ id: string; roomId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<FirestoreRoom[]>([]);
  const [items, setItems] = useState<FirestoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<FirestoreItem | null>(null);
  const [addingSuggestions, setAddingSuggestions] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<ItemStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<ItemPriority | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<ItemCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'price' | 'name' | 'status' | 'updated'>('priority');

  // Room notes
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState('');

  useEffect(() => {
    const u1 = watchProperty(id, p => { setProperty(p); setLoading(false); });
    const u2 = watchRooms(id, setRooms);
    const u3 = watchItems(id, setItems);
    return () => { u1(); u2(); u3(); };
  }, [id]);

  const room = rooms.find(r => r.id === roomId);
  const roomItems = items.filter(i => i.roomId === roomId);
  const installed = roomItems.filter(i => i.status === 'instalado').length;
  const totalEstimated = roomItems.reduce((s, i) => s + i.estimatedPrice, 0);
  const totalPaid = roomItems.reduce((s, i) => s + (i.paidPrice ?? 0), 0);
  const pct = roomItems.length > 0 ? Math.round((installed / roomItems.length) * 100) : 0;

  const usedCategories = [...new Set(roomItems.map(i => i.category))] as ItemCategory[];

  // Stable sort: compute sort order only when sortBy changes or items are added/removed
  const itemIds = roomItems.map(i => i.id).join(',');
  const sortedIds = useMemo(() => {
    const sorted = [...roomItems].sort((a, b) => {
      if (sortBy === 'price') return b.estimatedPrice - a.estimatedPrice;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'status') return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      if (sortBy === 'updated') {
        const ta = (a.updatedAt as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
        const tb = (b.updatedAt as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
        return tb - ta;
      }
      const po: Record<ItemPriority, number> = { muito_alta: 0, alta: 1, media: 2, baixa: 3 };
      return po[a.priority] - po[b.priority];
    });
    return sorted.map(i => i.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, itemIds]);

  const filtered = sortedIds
    .map(id => roomItems.find(i => i.id === id))
    .filter((i): i is FirestoreItem => !!i &&
      (filterStatus === 'all' || i.status === filterStatus) &&
      (filterPriority === 'all' || i.priority === filterPriority) &&
      (filterCategory === 'all' || i.category === filterCategory) &&
      (!search.trim() || i.name.toLowerCase().includes(search.toLowerCase()))
    );

  const hasSuggestions = (RS[room?.type ?? ''] ?? []).length > 0;

  const handleAddSuggestions = async () => {
    if (!user || !room) return;
    setAddingSuggestions(true);
    try {
      await Promise.all((RS[room.type] ?? []).map(s => createItem({
        roomId, propertyId: id, userId: user.uid,
        name: s.name, description: '', category: s.category,
        status: 'quero_comprar', priority: s.priority,
        estimatedPrice: s.estimatedPrice ?? 0, paidPrice: null, quantity: 1,
        store: null, productUrl: null, priceLinks: [], images: [], notes: '',
      })));
    } finally {
      setAddingSuggestions(false);
    }
  };

  const handleDeleteRoom = () => {
    Alert.alert('Excluir cômodo', `Excluir "${room?.name}"? Os itens também serão removidos.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await deleteRoom(roomId); router.back(); } },
    ]);
  };

  const saveNotes = async () => {
    await updateRoom(roomId, { notes: notesInput.trim() });
    setEditingNotes(false);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#B5602A" size="large" /></View>;
  if (!room) return <View style={s.center}><Text style={s.grayText}>Cômodo não encontrado.</Text></View>;

  const activeFilters = (filterStatus !== 'all' ? 1 : 0) + (filterPriority !== 'all' ? 1 : 0) + (filterCategory !== 'all' ? 1 : 0) + (search.trim() ? 1 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F5F2' }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← {property?.name ?? 'Voltar'} · Cômodos</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[s.roomIcon, { backgroundColor: room.color + '18', borderColor: room.color + '40' }]}>
            <Text style={{ fontSize: 22 }}>{room.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{room.name}</Text>
            <Text style={s.sub}>{roomItems.length} itens · {pct}% concluído</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => setAddingItem(true)}>
            <Text style={s.addBtnText}>+ Item</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}><Text style={s.statLabel}>Estimado</Text><Text style={[s.statVal, { color: '#B5602A' }]}>{fmt(totalEstimated)}</Text></View>
          <View style={s.statCard}><Text style={s.statLabel}>Pago</Text><Text style={[s.statVal, { color: '#5B8A72' }]}>{fmt(totalPaid)}</Text></View>
          <View style={s.statCard}><Text style={s.statLabel}>Instalados</Text><Text style={s.statVal}>{installed}/{roomItems.length}</Text></View>
          <View style={s.statCard}><Text style={s.statLabel}>Progresso</Text><Text style={[s.statVal, { color: room.color }]}>{pct}%</Text></View>
        </View>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: room.color }]} />
        </View>

        {/* Notes */}
        <View style={[s.card, { marginBottom: 10 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingNotes ? 8 : 0 }}>
            <Text style={s.fieldLabel}>Notas do cômodo</Text>
            {!editingNotes && (
              <TouchableOpacity onPress={() => { setEditingNotes(true); setNotesInput(room.notes ?? ''); }}>
                <Text style={{ fontSize: 13, color: '#B5602A' }}>✎ Editar</Text>
              </TouchableOpacity>
            )}
          </View>
          {editingNotes ? (
            <>
              <TextInput
                style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                value={notesInput} onChangeText={setNotesInput}
                placeholder="Observações sobre este cômodo..." placeholderTextColor="#9E9894"
                multiline autoFocus
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#F0EDE9' }]} onPress={() => setEditingNotes(false)}>
                  <Text style={[s.btnText, { color: '#1A1714' }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={saveNotes}>
                  <Text style={s.btnText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text style={{ fontSize: 14, color: room.notes ? '#1A1714' : '#9E9894', fontStyle: room.notes ? 'normal' : 'italic' }}>
              {room.notes || 'Nenhuma nota. Toque em editar para adicionar.'}
            </Text>
          )}
        </View>

        {/* Filters */}
        <View style={s.filtersCard}>
          {/* Search */}
          <TextInput
            style={s.searchInput}
            value={search} onChangeText={setSearch}
            placeholder="Buscar item..." placeholderTextColor="#9E9894"
          />

          {/* Status chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {[{ key: 'all', label: 'Todos' }, ...STATUS_ORDER.map(st => ({ key: st, label: STATUS_CONFIG[st].label }))].map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[s.filterChip, filterStatus === opt.key && { backgroundColor: '#B5602A', borderColor: '#B5602A' }]}
                onPress={() => setFilterStatus(opt.key as any)}
              >
                <Text style={[s.filterText, filterStatus === opt.key && { color: '#fff' }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Priority chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            <TouchableOpacity
              style={[s.filterChip, filterPriority === 'all' && { backgroundColor: '#F0EDE9', borderColor: '#C9C4BF' }]}
              onPress={() => setFilterPriority('all')}
            >
              <Text style={[s.filterText, filterPriority === 'all' && { fontWeight: '600' }]}>Qualquer prioridade</Text>
            </TouchableOpacity>
            {(Object.keys(PRIORITY_CONFIG) as ItemPriority[]).map(p => {
              const cfg = PRIORITY_CONFIG[p];
              return (
                <TouchableOpacity
                  key={p}
                  style={[s.filterChip, filterPriority === p && { backgroundColor: cfg.color + '15', borderColor: cfg.color }]}
                  onPress={() => setFilterPriority(filterPriority === p ? 'all' : p)}
                >
                  <Text style={[s.filterText, filterPriority === p && { color: cfg.color, fontWeight: '600' }]}>{cfg.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Category chips (only show categories with items) */}
          {usedCategories.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              <TouchableOpacity
                style={[s.filterChip, filterCategory === 'all' && { backgroundColor: '#F0EDE9', borderColor: '#C9C4BF' }]}
                onPress={() => setFilterCategory('all')}
              >
                <Text style={[s.filterText, filterCategory === 'all' && { fontWeight: '600' }]}>Todas categorias</Text>
              </TouchableOpacity>
              {usedCategories.map(cat => {
                const cfg = CATEGORIES[cat];
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[s.filterChip, filterCategory === cat && { backgroundColor: cfg.color + '15', borderColor: cfg.color }]}
                    onPress={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
                  >
                    <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: cfg.color }} />
                    <Text style={[s.filterText, filterCategory === cat && { color: cfg.color, fontWeight: '600' }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Sort chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            {[
              { key: 'priority', label: 'Prioridade' },
              { key: 'price', label: 'Preço' },
              { key: 'name', label: 'Nome' },
              { key: 'status', label: 'Status' },
              { key: 'updated', label: 'Recente' },
            ].map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[s.filterChip, sortBy === opt.key && { backgroundColor: '#F0EDE9', borderColor: '#C9C4BF' }]}
                onPress={() => setSortBy(opt.key as any)}
              >
                <Text style={[s.filterText, sortBy === opt.key && { fontWeight: '600' }]}>↕ {opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {activeFilters > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setFilterStatus('all'); setFilterPriority('all'); setFilterCategory('all'); }} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              <Text style={{ fontSize: 12, color: '#B5602A', fontWeight: '500' }}>✕ Limpar filtros ({activeFilters})</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Items */}
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 36, marginBottom: 10 }}>{room.icon}</Text>
            <Text style={s.emptyText}>
              {roomItems.length === 0 ? 'Nenhum item ainda.' : 'Nenhum item com esses filtros.'}
            </Text>
            {roomItems.length === 0 && (
              <View style={{ gap: 10 }}>
                <TouchableOpacity style={s.btn} onPress={() => setAddingItem(true)}>
                  <Text style={s.btnText}>Adicionar primeiro item</Text>
                </TouchableOpacity>
                {hasSuggestions && (
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#F0EDE9' }]} onPress={handleAddSuggestions} disabled={addingSuggestions}>
                    {addingSuggestions
                      ? <ActivityIndicator color="#B5602A" />
                      : <Text style={[s.btnText, { color: '#1A1714' }]}>✨ Sugerir itens para este cômodo</Text>
                    }
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ) : (
          <>
            <Text style={s.resultCount}>{filtered.length} {filtered.length === 1 ? 'item' : 'itens'}</Text>
            <View style={s.card}>
              {filtered.map(item => (
                <ItemRow key={item.id} item={item}
                  onEdit={() => setEditingItem(item)}
                  onDelete={() => {
                    Alert.alert('Excluir', `Excluir "${item.name}"?`, [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Excluir', style: 'destructive', onPress: () => deleteItem(item.id) },
                    ]);
                  }}
                  onStatusChange={status => updateItem(item.id, { status })}
                />
              ))}
            </View>
          </>
        )}

        <TouchableOpacity style={s.deleteBtn} onPress={handleDeleteRoom}>
          <Text style={s.deleteBtnText}>Excluir cômodo</Text>
        </TouchableOpacity>
      </ScrollView>

      {addingItem && user && (
        <ItemFormModal
          rooms={rooms} defaultRoomId={roomId} propertyId={id} userId={user.uid}
          onSave={async data => { await createItem(data); setAddingItem(false); }}
          onClose={() => setAddingItem(false)}
        />
      )}
      {editingItem && user && (
        <ItemFormModal
          rooms={rooms} defaultRoomId={editingItem.roomId} propertyId={id} userId={user.uid}
          item={editingItem}
          onSave={async data => { await updateItem(editingItem.id, data); setEditingItem(null); }}
          onDelete={async () => { await deleteItem(editingItem.id); setEditingItem(null); }}
          onClose={() => setEditingItem(null)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F5F2' },
  grayText: { fontSize: 14, color: '#9E9894' },
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E4E0DB' },
  back: { fontSize: 13, color: '#6B6460', marginBottom: 8 },
  roomIcon: { width: 44, height: 44, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1714' },
  sub: { fontSize: 13, color: '#9E9894', marginTop: 1 },
  addBtn: { backgroundColor: '#B5602A', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  body: { padding: 16, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#E4E0DB' },
  statLabel: { fontSize: 10, color: '#9E9894', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  statVal: { fontSize: 14, fontWeight: '700', color: '#1A1714' },
  progressBar: { height: 6, backgroundColor: '#F0EDE9', borderRadius: 3, marginBottom: 14 },
  progressFill: { height: 6, borderRadius: 3 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E4E0DB' },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#6B6460', marginBottom: 5, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  filtersCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#E4E0DB' },
  searchInput: {
    backgroundColor: '#F7F5F2', borderWidth: 1.5, borderColor: '#E4E0DB',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, color: '#1A1714',
  },
  filterChip: { borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginRight: 6, backgroundColor: '#F7F5F2' },
  filterText: { fontSize: 12, color: '#6B6460' },
  resultCount: { fontSize: 12, color: '#9E9894', marginBottom: 8, marginLeft: 2 },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 14, color: '#6B6460', marginBottom: 20, textAlign: 'center' },
  btn: { backgroundColor: '#B5602A', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  deleteBtn: { borderWidth: 1.5, borderColor: '#FECACA', borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#FFF5F5' },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
  input: { backgroundColor: '#F7F5F2', borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 10, padding: 12, fontSize: 14, color: '#1A1714', marginBottom: 4 },
});

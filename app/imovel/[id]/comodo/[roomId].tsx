import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  watchProperty, watchRooms, watchItems,
  createItem, updateItem, deleteItem, deleteRoom,
  ROOM_SUGGESTIONS,
} from '@/lib/firebase/firestore';
import {
  Property, FirestoreRoom, FirestoreItem, ItemStatus, ItemPriority, ItemCategory,
  STATUS_CONFIG, STATUS_ORDER, PRIORITY_CONFIG, CATEGORIES, ROOM_SUGGESTIONS as ROOM_SUGG,
} from '@/lib/types';

// Re-export ROOM_SUGGESTIONS from types since firestore doesn't have it
import { ROOM_SUGGESTIONS as RS } from '@/lib/types';

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
  const [filterStatus, setFilterStatus] = useState<ItemStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'price' | 'name' | 'status'>('priority');

  useEffect(() => {
    const unsub1 = watchProperty(id, p => { setProperty(p); setLoading(false); });
    const unsub2 = watchRooms(id, setRooms);
    const unsub3 = watchItems(id, setItems);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [id]);

  const room = rooms.find(r => r.id === roomId);
  const roomItems = items.filter(i => i.roomId === roomId);
  const installed = roomItems.filter(i => i.status === 'instalado').length;
  const totalEstimated = roomItems.reduce((s, i) => s + i.estimatedPrice, 0);
  const totalPaid = roomItems.reduce((s, i) => s + (i.paidPrice ?? 0), 0);
  const pct = roomItems.length > 0 ? Math.round((installed / roomItems.length) * 100) : 0;

  const filtered = roomItems
    .filter(i => filterStatus === 'all' || i.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === 'price') return b.estimatedPrice - a.estimatedPrice;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'status') return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      const po: Record<ItemPriority, number> = { muito_alta: 0, alta: 1, media: 2, baixa: 3 };
      return po[a.priority] - po[b.priority];
    });

  const hasSuggestions = (RS[room?.type ?? ''] ?? []).length > 0;

  const handleAddSuggestions = async () => {
    if (!user || !room) return;
    const suggestions = RS[room.type] ?? [];
    setAddingSuggestions(true);
    try {
      await Promise.all(suggestions.map(s => createItem({
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

  if (loading) return <View style={s.center}><ActivityIndicator color="#B5602A" size="large" /></View>;
  if (!room) return <View style={s.center}><Text style={s.grayText}>Cômodo não encontrado.</Text></View>;

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

        {/* Filters */}
        <View style={s.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[{ key: 'all', label: 'Todos' }, ...STATUS_ORDER.map(s => ({ key: s, label: STATUS_CONFIG[s].label }))].map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[s.filterChip, filterStatus === opt.key && { backgroundColor: '#B5602A', borderColor: '#B5602A' }]}
                onPress={() => setFilterStatus(opt.key as any)}
              >
                <Text style={[s.filterText, filterStatus === opt.key && { color: '#fff' }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
            {[
              { key: 'priority', label: 'Prioridade' },
              { key: 'price', label: 'Preço' },
              { key: 'name', label: 'Nome' },
              { key: 'status', label: 'Status' },
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
        )}

        {/* Delete room */}
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

function ItemRow({ item, onEdit, onDelete, onStatusChange }: {
  item: FirestoreItem; onEdit: () => void; onDelete: () => void;
  onStatusChange: (s: ItemStatus) => void;
}) {
  const status = STATUS_CONFIG[item.status];
  const priority = PRIORITY_CONFIG[item.priority];
  const nextStatus = STATUS_ORDER[(STATUS_ORDER.indexOf(item.status) + 1) % STATUS_ORDER.length];
  const isInstalled = item.status === 'instalado';

  return (
    <View style={ir.row}>
      <TouchableOpacity
        style={[ir.checkbox, { borderColor: status.dot, backgroundColor: (item.status === 'comprado' || isInstalled) ? status.dot : 'transparent' }]}
        onPress={() => onStatusChange(nextStatus)}
      >
        {(item.status === 'comprado' || isInstalled) && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[ir.name, isInstalled && { textDecorationLine: 'line-through', color: '#9E9894' }]} numberOfLines={1}>
          {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
        </Text>
        <Text style={ir.meta}>{CATEGORIES[item.category].label}{item.store ? ` · ${item.store}` : ''}{item.notes ? ` · ${item.notes}` : ''}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <View style={[ir.badge, { backgroundColor: status.bg }]}>
          <Text style={[ir.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
        <View style={[ir.priorityBadge, { backgroundColor: priority.color + '15' }]}>
          <Text style={[ir.priorityText, { color: priority.color }]}>{priority.label}</Text>
        </View>
        {item.estimatedPrice > 0 && <Text style={ir.price}>{fmt(item.estimatedPrice)}</Text>}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={onEdit}><Text style={{ color: '#B5602A', fontSize: 14 }}>✎</Text></TouchableOpacity>
          <TouchableOpacity onPress={onDelete}><Text style={{ color: '#DC2626', fontSize: 14 }}>🗑</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ItemFormModal({ rooms, defaultRoomId, propertyId, userId, item, onSave, onDelete, onClose }: {
  rooms: FirestoreRoom[]; defaultRoomId: string; propertyId: string; userId: string;
  item?: FirestoreItem; onSave: (data: any) => Promise<void>;
  onDelete?: () => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [roomId, setRoomId] = useState(item?.roomId ?? defaultRoomId);
  const [category, setCategory] = useState(item?.category ?? 'moveis');
  const [status, setStatus] = useState(item?.status ?? 'quero_comprar');
  const [priority, setPriority] = useState(item?.priority ?? 'media');
  const [estimatedPrice, setEstimatedPrice] = useState(String(item?.estimatedPrice ?? ''));
  const [paidPrice, setPaidPrice] = useState(String(item?.paidPrice ?? ''));
  const [store, setStore] = useState(item?.store ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Atenção', 'O nome é obrigatório.'); return; }
    setSaving(true);
    await onSave({
      roomId, propertyId, userId, name: name.trim(), description: '',
      category, status, priority,
      estimatedPrice: parseFloat(estimatedPrice) || 0,
      paidPrice: paidPrice ? parseFloat(paidPrice) : null,
      quantity: parseInt(quantity) || 1,
      store: store.trim() || null, productUrl: item?.productUrl ?? null,
      priceLinks: item?.priceLinks ?? [], images: item?.images ?? [],
      notes: notes.trim(),
    });
    setSaving(false);
  };

  return (
    <Modal visible transparent animationType="slide">
      <View style={s.modalBackdrop}>
        <View style={[s.modal, { maxHeight: '90%' }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.modalTitle}>{item ? 'Editar item' : 'Novo item'}</Text>

            <Text style={s.fieldLabel}>Nome *</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ex: Sofá..." placeholderTextColor="#9E9894" autoFocus />

            <Text style={s.fieldLabel}>Cômodo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {rooms.map(r => (
                <TouchableOpacity key={r.id} style={[s.chip, roomId === r.id && { borderColor: r.color, backgroundColor: r.color + '15' }]} onPress={() => setRoomId(r.id)}>
                  <Text style={{ fontSize: 14 }}>{r.icon}</Text>
                  <Text style={[s.chipText, roomId === r.id && { color: r.color, fontWeight: '600' }]}>{r.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {(Object.entries(CATEGORIES) as [string, any][]).map(([key, val]) => (
                <TouchableOpacity key={key} style={[s.chip, category === key && { borderColor: val.color, backgroundColor: val.color + '15' }]} onPress={() => setCategory(key as any)}>
                  <Text style={[s.chipText, category === key && { color: val.color, fontWeight: '600' }]}>{val.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {STATUS_ORDER.map(st => {
                const cfg = STATUS_CONFIG[st];
                return (
                  <TouchableOpacity key={st} style={[s.chip, status === st && { borderColor: cfg.dot, backgroundColor: cfg.bg }]} onPress={() => setStatus(st)}>
                    <Text style={[s.chipText, status === st && { color: cfg.color, fontWeight: '600' }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.fieldLabel}>Prioridade</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              {(Object.entries(PRIORITY_CONFIG) as [string, any][]).map(([key, val]) => (
                <TouchableOpacity key={key} style={[s.chip, priority === key && { borderColor: val.color, backgroundColor: val.color + '15' }]} onPress={() => setPriority(key as any)}>
                  <Text style={[s.chipText, priority === key && { color: val.color, fontWeight: '600' }]}>{val.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Estimado (R$)</Text>
                <TextInput style={s.input} value={estimatedPrice} onChangeText={setEstimatedPrice} keyboardType="numeric" placeholder="0" placeholderTextColor="#9E9894" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Pago (R$)</Text>
                <TextInput style={s.input} value={paidPrice} onChangeText={setPaidPrice} keyboardType="numeric" placeholder="0" placeholderTextColor="#9E9894" />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Qtd</Text>
                <TextInput style={s.input} value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="1" placeholderTextColor="#9E9894" />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={s.fieldLabel}>Loja</Text>
                <TextInput style={s.input} value={store} onChangeText={setStore} placeholder="Ex: Tok&Stok" placeholderTextColor="#9E9894" />
              </View>
            </View>

            <Text style={s.fieldLabel}>Observações</Text>
            <TextInput style={[s.input, { height: 60, textAlignVertical: 'top', paddingTop: 10 }]} value={notes} onChangeText={setNotes} multiline placeholder="Detalhes adicionais..." placeholderTextColor="#9E9894" />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#F0EDE9' }]} onPress={onClose}>
                <Text style={[s.btnText, { color: '#1A1714' }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{item ? 'Salvar' : 'Adicionar'}</Text>}
              </TouchableOpacity>
            </View>
            {onDelete && (
              <TouchableOpacity style={[s.btn, { marginTop: 8, backgroundColor: '#FEE2E2' }]} onPress={() => {
                Alert.alert('Excluir item', 'Tem certeza?', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Excluir', style: 'destructive', onPress: onDelete },
                ]);
              }}>
                <Text style={[s.btnText, { color: '#DC2626' }]}>Excluir item</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F5F2' },
  grayText: { fontSize: 14, color: '#9E9894' },
  header: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#E4E0DB',
  },
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
  filters: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#E4E0DB' },
  filterChip: { borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginRight: 6, backgroundColor: '#F7F5F2' },
  filterText: { fontSize: 12, color: '#6B6460' },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 14, color: '#6B6460', marginBottom: 20, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E4E0DB' },
  btn: { backgroundColor: '#B5602A', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  deleteBtn: { borderWidth: 1.5, borderColor: '#FECACA', borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#FFF5F5' },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1714', marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: '#6B6460', marginBottom: 5, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F7F5F2', borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 10, padding: 12, fontSize: 14, color: '#1A1714', marginBottom: 4 },
  chip: { borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F7F5F2' },
  chipText: { fontSize: 12, color: '#6B6460' },
});

const ir = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0EDE9' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
  name: { fontSize: 14, fontWeight: '500', color: '#1A1714' },
  meta: { fontSize: 11, color: '#9E9894', marginTop: 2 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '500' },
  priorityBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  priorityText: { fontSize: 10, fontWeight: '600' },
  price: { fontSize: 13, fontWeight: '700', color: '#1A1714' },
});

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  watchProperty, watchRooms, watchItems,
  createRoom, deleteRoom, createItem, updateItem, deleteItem,
} from '@/lib/firebase/firestore';
import {
  Property, FirestoreRoom, FirestoreItem, PriceLink,
  STATUS_CONFIG, STATUS_ORDER, PRIORITY_CONFIG, CATEGORIES, ROOM_TYPES, ItemStatus,
} from '@/lib/types';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

export default function ComodosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<FirestoreRoom[]>([]);
  const [items, setItems] = useState<FirestoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomType, setNewRoomType] = useState('sala');
  const [newRoomName, setNewRoomName] = useState('');
  const [addingItemRoom, setAddingItemRoom] = useState<FirestoreRoom | null>(null);
  const [editingItem, setEditingItem] = useState<FirestoreItem | null>(null);

  useEffect(() => {
    const unsub1 = watchProperty(id, p => { setProperty(p); setLoading(false); });
    const unsub2 = watchRooms(id, setRooms);
    const unsub3 = watchItems(id, setItems);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [id]);

  const toggleRoom = (roomId: string) => {
    setCollapsed(prev => {
      const n = new Set(prev);
      n.has(roomId) ? n.delete(roomId) : n.add(roomId);
      return n;
    });
  };

  const handleAddRoom = async () => {
    if (!user) return;
    const rt = ROOM_TYPES.find(r => r.type === newRoomType);
    await createRoom({
      propertyId: id, userId: user.uid,
      name: newRoomName.trim() || (rt?.name ?? 'Novo Cômodo'),
      type: newRoomType, icon: rt?.icon ?? '🏠', color: rt?.color ?? '#8A8A8A',
      order: rooms.length, notes: '',
    });
    setShowAddRoom(false);
    setNewRoomName('');
  };

  const handleDeleteRoom = (room: FirestoreRoom) => {
    Alert.alert('Excluir cômodo', `Excluir "${room.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteRoom(room.id) },
    ]);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#B5602A" size="large" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F5F2' }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← {property?.name ?? 'Voltar'}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.title}>Cômodos</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAddRoom(true)}>
            <Text style={s.addBtnText}>+ Novo</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.sub}>{rooms.length} ambiente{rooms.length !== 1 ? 's' : ''} · {items.length} iten{items.length !== 1 ? 's' : ''}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {rooms.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🏠</Text>
            <Text style={s.emptyText}>Nenhum cômodo ainda.</Text>
            <TouchableOpacity style={s.btn} onPress={() => setShowAddRoom(true)}>
              <Text style={s.btnText}>Adicionar cômodo</Text>
            </TouchableOpacity>
          </View>
        ) : rooms.map(room => {
          const roomItems = items.filter(i => i.roomId === room.id);
          const total = roomItems.reduce((s, i) => s + i.estimatedPrice, 0);
          const installed = roomItems.filter(i => i.status === 'instalado').length;
          const isOpen = !collapsed.has(room.id);
          const pct = roomItems.length > 0 ? (installed / roomItems.length) * 100 : 0;

          return (
            <View key={room.id} style={s.roomCard}>
              <TouchableOpacity
                style={[s.roomHeader, isOpen && { borderBottomWidth: 1, borderBottomColor: '#E4E0DB' }]}
                onPress={() => toggleRoom(room.id)}
                activeOpacity={0.8}
              >
                <View style={[s.roomIconBadge, { backgroundColor: room.color + '18', borderColor: room.color + '40' }]}>
                  <Text style={{ fontSize: 18 }}>{room.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={s.roomName}>{room.name}</Text>
                    <Text style={s.roomCount}>{roomItems.length} itens</Text>
                  </View>
                  {roomItems.length > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 }}>
                      <View style={[s.progressBar, { width: 80 }]}>
                        <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: room.color }]} />
                      </View>
                      <Text style={s.graySmall}>{installed}/{roomItems.length}</Text>
                    </View>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[s.roomTotal, { color: room.color }]}>{fmt(total)}</Text>
                  <Text style={{ color: '#C9C4BF', fontSize: 18 }}>{isOpen ? '▾' : '›'}</Text>
                </View>
              </TouchableOpacity>

              {isOpen && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
                  {/* Actions */}
                  <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 10 }}>
                    <TouchableOpacity style={s.roomActionBtn} onPress={() => router.push(`/imovel/${id}/comodo/${room.id}`)}>
                      <Text style={s.roomActionLink}>Abrir cômodo →</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.roomActionBtnPrimary} onPress={() => setAddingItemRoom(room)}>
                      <Text style={s.roomActionBtnText}>+ Item</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.roomActionBtnDanger} onPress={() => handleDeleteRoom(room)}>
                      <Text style={s.roomActionBtnDangerText}>Excluir</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Items */}
                  {roomItems.length === 0 ? (
                    <Text style={[s.graySmall, { textAlign: 'center', paddingVertical: 12 }]}>
                      Nenhum item.{' '}
                      <Text style={{ color: '#B5602A' }} onPress={() => setAddingItemRoom(room)}>Adicionar →</Text>
                    </Text>
                  ) : roomItems.map(item => (
                    <ItemRow key={item.id} item={item}
                      onEdit={() => setEditingItem(item)}
                      onDelete={() => {
                        Alert.alert('Excluir item', `Excluir "${item.name}"?`, [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Excluir', style: 'destructive', onPress: () => deleteItem(item.id) },
                        ]);
                      }}
                      onStatusChange={status => updateItem(item.id, { status })}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Add Room Modal */}
      <Modal visible={showAddRoom} transparent animationType="slide">
        <View style={s.modalBackdrop}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Novo cômodo</Text>
            <Text style={s.label}>Tipo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {ROOM_TYPES.map(rt => (
                <TouchableOpacity
                  key={rt.type}
                  style={[s.roomTypeBtn, newRoomType === rt.type && { borderColor: rt.color, backgroundColor: rt.color + '15' }]}
                  onPress={() => setNewRoomType(rt.type)}
                >
                  <Text style={{ fontSize: 18 }}>{rt.icon}</Text>
                  <Text style={[s.roomTypeName, newRoomType === rt.type && { color: rt.color, fontWeight: '600' }]}>{rt.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.label}>Nome personalizado (opcional)</Text>
            <TextInput
              style={s.input}
              value={newRoomName} onChangeText={setNewRoomName}
              placeholder={ROOM_TYPES.find(r => r.type === newRoomType)?.name}
              placeholderTextColor="#9E9894"
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#F0EDE9' }]} onPress={() => { setShowAddRoom(false); setNewRoomName(''); }}>
                <Text style={[s.btnText, { color: '#1A1714' }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={handleAddRoom}>
                <Text style={s.btnText}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Item Modal */}
      {addingItemRoom && user && (
        <ItemFormModal
          room={addingItemRoom}
          rooms={rooms}
          propertyId={id}
          userId={user.uid}
          onSave={async data => { await createItem(data); setAddingItemRoom(null); }}
          onClose={() => setAddingItemRoom(null)}
        />
      )}

      {/* Edit Item Modal */}
      {editingItem && user && (
        <ItemFormModal
          room={rooms.find(r => r.id === editingItem.roomId) ?? rooms[0]}
          rooms={rooms}
          propertyId={id}
          userId={user.uid}
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
  item: FirestoreItem;
  onEdit: () => void;
  onDelete: () => void;
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
        {(item.status === 'comprado' || isInstalled) && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
      </TouchableOpacity>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[ir.name, isInstalled && { textDecorationLine: 'line-through', color: '#9E9894' }]} numberOfLines={1}>
          {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
        </Text>
        <Text style={ir.meta} numberOfLines={1}>
          {CATEGORIES[item.category].label}{item.store ? ` · ${item.store}` : ''}
        </Text>
        {item.notes ? <Text style={ir.notes} numberOfLines={1}>{item.notes}</Text> : null}
        {item.productUrl ? (
          <TouchableOpacity onPress={() => Linking.openURL(item.productUrl!).catch(() => {})}>
            <Text style={ir.link}>🔗 Ver produto</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={[ir.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[ir.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        {item.estimatedPrice > 0 && (
          <Text style={ir.price}>{item.estimatedPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}</Text>
        )}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity onPress={onEdit}><Text style={{ color: '#B5602A', fontSize: 14 }}>✎</Text></TouchableOpacity>
          <TouchableOpacity onPress={onDelete}><Text style={{ color: '#DC2626', fontSize: 14 }}>🗑</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ItemFormModal({ room, rooms, propertyId, userId, item, onSave, onDelete, onClose }: {
  room: FirestoreRoom;
  rooms: FirestoreRoom[];
  propertyId: string;
  userId: string;
  item?: FirestoreItem;
  onSave: (data: any) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [roomId, setRoomId] = useState(item?.roomId ?? room.id);
  const [category, setCategory] = useState(item?.category ?? 'moveis');
  const [status, setStatus] = useState(item?.status ?? 'quero_comprar');
  const [priority, setPriority] = useState(item?.priority ?? 'media');
  const [estimatedPrice, setEstimatedPrice] = useState(String(item?.estimatedPrice ?? ''));
  const [paidPrice, setPaidPrice] = useState(String(item?.paidPrice ?? ''));
  const [store, setStore] = useState(item?.store ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [productUrl, setProductUrl] = useState(item?.productUrl ?? '');
  const [priceLinks, setPriceLinks] = useState<PriceLink[]>(item?.priceLinks ?? []);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkPrice, setNewLinkPrice] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const addPriceLink = () => {
    const price = parseFloat(newLinkPrice.replace(',', '.'));
    if (!newLinkUrl.trim() || isNaN(price)) return;
    const label = newLinkLabel.trim() || (() => {
      try { return new URL(newLinkUrl.startsWith('http') ? newLinkUrl : `https://${newLinkUrl}`).hostname.replace(/^www\./, ''); }
      catch { return newLinkUrl; }
    })();
    setPriceLinks(prev => [...prev, { url: newLinkUrl.trim(), price, label }]);
    const avg = [...priceLinks, { url: newLinkUrl.trim(), price, label }].reduce((s, l) => s + l.price, 0) / (priceLinks.length + 1);
    setEstimatedPrice(String(Math.round(avg)));
    setNewLinkUrl(''); setNewLinkPrice(''); setNewLinkLabel('');
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Atenção', 'O nome é obrigatório.'); return; }
    setSaving(true);
    await onSave({
      roomId, propertyId, userId,
      name: name.trim(),
      description: '',
      category,
      status,
      priority,
      estimatedPrice: parseFloat(estimatedPrice) || 0,
      paidPrice: paidPrice ? parseFloat(paidPrice) : null,
      quantity: parseInt(quantity) || 1,
      store: store.trim() || null,
      productUrl: productUrl.trim() || null,
      priceLinks,
      images: item?.images ?? [],
      notes: notes.trim(),
    });
    setSaving(false);
  };

  const CATS = Object.entries(CATEGORIES) as [string, { label: string; color: string }][];
  const STATUSES = Object.entries(STATUS_CONFIG) as [string, { label: string; color: string; bg: string; dot: string }][];
  const PRIOS = Object.entries(PRIORITY_CONFIG) as [string, { label: string; color: string }][];

  return (
    <Modal visible transparent animationType="slide">
      <View style={s.modalBackdrop}>
        <View style={[s.modal, { maxHeight: '90%' }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={s.modalTitle}>{item ? 'Editar item' : 'Novo item'}</Text>

            <Text style={s.label}>Nome *</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ex: Sofá, Geladeira..." placeholderTextColor="#9E9894" />

            <Text style={s.label}>Cômodo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {rooms.map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={[s.chipBtn, roomId === r.id && { borderColor: r.color, backgroundColor: r.color + '15' }]}
                  onPress={() => setRoomId(r.id)}
                >
                  <Text style={{ fontSize: 14 }}>{r.icon}</Text>
                  <Text style={[s.chipText, roomId === r.id && { color: r.color, fontWeight: '600' }]}>{r.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.label}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {CATS.map(([key, val]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.chipBtn, category === key && { borderColor: val.color, backgroundColor: val.color + '15' }]}
                  onPress={() => setCategory(key as any)}
                >
                  <Text style={[s.chipText, category === key && { color: val.color, fontWeight: '600' }]}>{val.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.label}>Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {STATUSES.map(([key, val]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.chipBtn, status === key && { borderColor: val.dot, backgroundColor: val.bg }]}
                  onPress={() => setStatus(key as any)}
                >
                  <Text style={[s.chipText, status === key && { color: val.color, fontWeight: '600' }]}>{val.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>Prioridade</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {PRIOS.map(([key, val]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.chipBtn, priority === key && { borderColor: val.color, backgroundColor: val.color + '15' }]}
                  onPress={() => setPriority(key as any)}
                >
                  <Text style={[s.chipText, priority === key && { color: val.color, fontWeight: '600' }]}>{val.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Preço estimado</Text>
                <TextInput style={s.input} value={estimatedPrice} onChangeText={setEstimatedPrice} placeholder="0" placeholderTextColor="#9E9894" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Preço pago</Text>
                <TextInput style={s.input} value={paidPrice} onChangeText={setPaidPrice} placeholder="0" placeholderTextColor="#9E9894" keyboardType="numeric" />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Quantidade</Text>
                <TextInput style={s.input} value={quantity} onChangeText={setQuantity} placeholder="1" placeholderTextColor="#9E9894" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Loja</Text>
                <TextInput style={s.input} value={store} onChangeText={setStore} placeholder="Ex: Tok&Stok" placeholderTextColor="#9E9894" />
              </View>
            </View>

            <Text style={s.label}>Observações</Text>
            <TextInput
              style={[s.input, { height: 70, textAlignVertical: 'top', paddingTop: 10 }]}
              value={notes} onChangeText={setNotes}
              placeholder="Detalhes adicionais..."
              placeholderTextColor="#9E9894" multiline
            />

            <Text style={s.label}>URL do produto</Text>
            <TextInput
              style={s.input} value={productUrl} onChangeText={setProductUrl}
              placeholder="https://..." placeholderTextColor="#9E9894"
              autoCapitalize="none" keyboardType="url"
            />

            <Text style={s.label}>Links de preço</Text>
            {priceLinks.map((l, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <View style={{ flex: 1, backgroundColor: '#F7F5F2', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#E4E0DB' }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#1A1714' }}>{l.label}</Text>
                  <Text style={{ fontSize: 11, color: '#9E9894' }} numberOfLines={1}>{l.url}</Text>
                  <Text style={{ fontSize: 12, color: '#5B8A72', fontWeight: '600', marginTop: 2 }}>
                    {l.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setPriceLinks(prev => prev.filter((_, idx) => idx !== i))}>
                  <Text style={{ color: '#DC2626', fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <View style={{ backgroundColor: '#F7F5F2', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E4E0DB', marginBottom: 4 }}>
              <Text style={{ fontSize: 11, color: '#9E9894', marginBottom: 8, fontWeight: '600' }}>ADICIONAR LINK</Text>
              <TextInput
                style={[s.input, { marginBottom: 6 }]} value={newLinkUrl} onChangeText={setNewLinkUrl}
                placeholder="URL da loja" placeholderTextColor="#9E9894"
                autoCapitalize="none" keyboardType="url"
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]} value={newLinkLabel} onChangeText={setNewLinkLabel}
                  placeholder="Loja (opcional)" placeholderTextColor="#9E9894"
                />
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]} value={newLinkPrice} onChangeText={setNewLinkPrice}
                  placeholder="Preço" placeholderTextColor="#9E9894" keyboardType="numeric"
                />
              </View>
              <TouchableOpacity
                style={[s.btn, { marginTop: 8, paddingVertical: 10, backgroundColor: newLinkUrl.trim() && newLinkPrice ? '#B5602A' : '#E4E0DB' }]}
                onPress={addPriceLink} disabled={!newLinkUrl.trim() || !newLinkPrice}
              >
                <Text style={[s.btnText, { fontSize: 13 }]}>+ Adicionar link</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
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
  header: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#E4E0DB',
  },
  back: { fontSize: 14, color: '#6B6460', marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1714', letterSpacing: -0.4 },
  sub: { fontSize: 13, color: '#9E9894', marginTop: 2 },
  addBtn: { backgroundColor: '#B5602A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 14, color: '#6B6460', marginBottom: 20 },
  btn: { backgroundColor: '#B5602A', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  roomCard: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 12,
    borderWidth: 1, borderColor: '#E4E0DB', overflow: 'hidden',
  },
  roomHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  roomIconBadge: { width: 40, height: 40, borderRadius: 9, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  roomName: { fontSize: 15, fontWeight: '600', color: '#1A1714' },
  roomCount: { fontSize: 12, color: '#9E9894' },
  roomTotal: { fontSize: 16, fontWeight: '600' },
  progressBar: { height: 5, backgroundColor: '#F0EDE9', borderRadius: 3 },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: '#B5602A' },
  graySmall: { fontSize: 11, color: '#9E9894' },
  roomActionBtn: { borderWidth: 1, borderColor: '#E4E0DB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  roomActionLink: { fontSize: 13, color: '#B5602A', fontWeight: '500' },
  roomActionBtnPrimary: { backgroundColor: '#B5602A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  roomActionBtnText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  roomActionBtnDanger: { borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFF5F5' },
  roomActionBtnDangerText: { fontSize: 13, color: '#DC2626', fontWeight: '500' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1714', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#6B6460', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#F7F5F2', borderWidth: 1.5, borderColor: '#E4E0DB',
    borderRadius: 10, padding: 12, fontSize: 14, color: '#1A1714', marginBottom: 4,
  },
  roomTypeBtn: {
    borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginRight: 8,
    alignItems: 'center', backgroundColor: '#F7F5F2',
  },
  roomTypeName: { fontSize: 11, color: '#6B6460', marginTop: 2 },
  chipBtn: {
    borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5, marginRight: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F7F5F2',
  },
  chipText: { fontSize: 12, color: '#6B6460' },
});

const ir = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EDE9',
  },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginTop: 2, flexShrink: 0 },
  name: { fontSize: 14, fontWeight: '500', color: '#1A1714' },
  meta: { fontSize: 11, color: '#9E9894', marginTop: 2 },
  notes: { fontSize: 11, color: '#6B6460', marginTop: 2, fontStyle: 'italic' },
  link: { fontSize: 11, color: '#B5602A', marginTop: 3, textDecorationLine: 'underline' },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: '500' },
  price: { fontSize: 13, fontWeight: '700', color: '#1A1714' },
});

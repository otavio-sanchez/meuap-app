import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  watchProperty, watchRooms, watchItems,
  createRoom, deleteRoom, createItem, updateItem, deleteItem,
} from '@/lib/firebase/firestore';
import {
  Property, FirestoreRoom, FirestoreItem,
  STATUS_CONFIG, ROOM_TYPES, ItemStatus,
} from '@/lib/types';
import { ItemRow } from '@/components/ItemRow';
import { ItemFormModal } from '@/components/ItemFormModal';

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
          defaultRoomId={addingItemRoom.id}
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
          defaultRoomId={editingItem.roomId}
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
  roomTypeBtn: {
    borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginRight: 8,
    alignItems: 'center', backgroundColor: '#F7F5F2',
  },
  roomTypeName: { fontSize: 11, color: '#6B6460', marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1714', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#6B6460', marginBottom: 6, marginTop: 10, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  input: { backgroundColor: '#F7F5F2', borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 10, padding: 12, fontSize: 14, color: '#1A1714', marginBottom: 4 },
});

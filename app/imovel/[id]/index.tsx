import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput, Share, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  watchProperty, watchRooms, watchItems,
  updateProperty, deleteProperty,
} from '@/lib/firebase/firestore';
import {
  Property, PropertyMember, FirestoreRoom, FirestoreItem,
  CATEGORIES, STATUS_CONFIG, PROPERTY_TYPES, ItemStatus, ItemCategory,
} from '@/lib/types';

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

  // Inline edits
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [editingArea, setEditingArea] = useState(false);
  const [areaInput, setAreaInput] = useState('');
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  useEffect(() => {
    const u1 = watchProperty(id, p => { setProperty(p); setLoading(false); });
    const u2 = watchRooms(id, setRooms);
    const u3 = watchItems(id, setItems);
    return () => { u1(); u2(); u3(); };
  }, [id]);

  if (loading) return <View style={s.center}><ActivityIndicator color="#B5602A" size="large" /></View>;
  if (!property) return <View style={s.center}><Text style={s.grayText}>Imóvel não encontrado.</Text></View>;

  const totalEstimated = items.reduce((sum, i) => sum + i.estimatedPrice, 0);
  const totalPaid = items.reduce((sum, i) => sum + (i.paidPrice ?? 0), 0);
  const installed = items.filter(i => i.status === 'instalado').length;
  const completionPct = items.length > 0 ? Math.round((installed / items.length) * 100) : 0;
  const remaining = (property.totalBudget || 0) - totalEstimated;

  const categoryTotals = (Object.keys(CATEGORIES) as ItemCategory[])
    .map(cat => ({
      cat, ...CATEGORIES[cat],
      total: items.filter(i => i.category === cat).reduce((acc, i) => acc + i.estimatedPrice, 0),
      count: items.filter(i => i.category === cat).length,
    }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.total - a.total);

  const isOwner = (property.members ?? []).find((m: PropertyMember) => m.uid === user?.uid)?.role === 'owner';

  const saveName = async () => {
    const v = nameInput.trim();
    if (v) await updateProperty(id, { name: v });
    setEditingName(false);
  };
  const saveArea = async () => {
    const v = parseFloat(areaInput.replace(',', '.'));
    if (!isNaN(v) && v >= 0) await updateProperty(id, { area: v });
    setEditingArea(false);
  };
  const saveAddress = async () => {
    await updateProperty(id, { address: addressInput.trim() });
    setEditingAddress(false);
  };
  const saveBudget = async () => {
    const v = parseFloat(budgetInput.replace(',', '.'));
    if (!isNaN(v) && v >= 0) await updateProperty(id, { totalBudget: v });
    setEditingBudget(false);
  };

  const handleTogglePublic = () => updateProperty(id, { isPublic: !property.isPublic });
  const handleToggleInvite = () => updateProperty(id, { inviteEnabled: !property.inviteEnabled });

  const handleShareInvite = async () => {
    await Share.share({ message: `Você foi convidado para colaborar no imóvel "${property.name}". Acesse: https://meuap.app/join/${id}` });
  };

  const handleSharePublic = async () => {
    await Share.share({ message: `Veja o projeto "${property.name}": https://meuap.app/p/${id}` });
  };

  const removeMember = (uid: string) => {
    Alert.alert('Remover colaborador', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive', onPress: () => updateProperty(id, {
          memberUids: (property.memberUids ?? []).filter(u => u !== uid),
          members: (property.members ?? []).filter((m: PropertyMember) => m.uid !== uid),
        }),
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Excluir imóvel', `Tem certeza que deseja excluir "${property.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => { await deleteProperty(id); router.replace('/(app)'); } },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F5F2' }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← Imóveis</Text>
        </TouchableOpacity>

        {/* Name (editable) */}
        {editingName ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <TextInput
              style={[s.inlineInput, { flex: 1 }]}
              value={nameInput} onChangeText={setNameInput}
              autoFocus onSubmitEditing={saveName}
            />
            <TouchableOpacity style={s.inlineSave} onPress={saveName}><Text style={s.inlineSaveText}>✓</Text></TouchableOpacity>
            <TouchableOpacity style={s.inlineCancel} onPress={() => setEditingName(false)}><Text style={s.inlineCancelText}>✕</Text></TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => { setEditingName(true); setNameInput(property.name); }} activeOpacity={0.7}>
            <Text style={s.title} numberOfLines={1}>{property.name} <Text style={{ color: '#B5602A', fontSize: 14 }}>✎</Text></Text>
          </TouchableOpacity>
        )}

        {/* Type · Area (editable) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          <Text style={s.sub}>{PROPERTY_TYPES[property.type]}</Text>
          {editingArea ? (
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <TextInput
                style={[s.inlineInput, { width: 60 }]}
                value={areaInput} onChangeText={setAreaInput}
                keyboardType="numeric" autoFocus onSubmitEditing={saveArea}
              />
              <Text style={s.sub}>m²</Text>
              <TouchableOpacity style={s.inlineSave} onPress={saveArea}><Text style={s.inlineSaveText}>✓</Text></TouchableOpacity>
              <TouchableOpacity style={s.inlineCancel} onPress={() => setEditingArea(false)}><Text style={s.inlineCancelText}>✕</Text></TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => { setEditingArea(true); setAreaInput(String(property.area ?? 0)); }}>
              <Text style={s.sub}>{property.area > 0 ? `· ${property.area}m² ✎` : '· + m² ✎'}</Text>
            </TouchableOpacity>
          )}
          {rooms.length > 0 && <Text style={s.sub}>· {rooms.length} cômodo{rooms.length !== 1 ? 's' : ''}</Text>}
        </View>

        {/* Address (editable) */}
        {editingAddress ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <TextInput
              style={[s.inlineInput, { flex: 1 }]}
              value={addressInput} onChangeText={setAddressInput}
              placeholder="Ex: Rua das Flores, 123 - SP"
              placeholderTextColor="#9E9894"
              autoFocus onSubmitEditing={saveAddress}
            />
            <TouchableOpacity style={s.inlineSave} onPress={saveAddress}><Text style={s.inlineSaveText}>✓</Text></TouchableOpacity>
            <TouchableOpacity style={s.inlineCancel} onPress={() => setEditingAddress(false)}><Text style={s.inlineCancelText}>✕</Text></TouchableOpacity>
          </View>
        ) : property.address ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <TouchableOpacity onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address ?? '')}`)}>
              <Text style={[s.address, { textDecorationLine: 'underline' }]} numberOfLines={1}>📍 {property.address} ↗</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setEditingAddress(true); setAddressInput(property.address ?? ''); }}>
              <Text style={{ color: '#B5602A', fontSize: 13 }}>✎</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => { setEditingAddress(true); setAddressInput(''); }} style={{ marginTop: 4 }}>
            <Text style={[s.address, { fontStyle: 'italic', color: '#C9C4BF' }]}>📍 Adicionar endereço</Text>
          </TouchableOpacity>
        )}

        {/* Public toggle + share */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <TouchableOpacity style={s.toggleRow} onPress={handleTogglePublic}>
            <View style={[s.toggle, property.isPublic && s.toggleOn]}>
              <View style={[s.toggleThumb, property.isPublic && s.toggleThumbOn]} />
            </View>
            <Text style={s.toggleLabel}>{property.isPublic ? 'Público' : 'Privado'}</Text>
          </TouchableOpacity>
          {property.isPublic && (
            <TouchableOpacity style={s.shareBtn} onPress={handleSharePublic}>
              <Text style={s.shareBtnText}>🔗 Compartilhar</Text>
            </TouchableOpacity>
          )}
        </View>
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
            <View style={[s.progressFill, { width: `${completionPct}%` as any, backgroundColor: completionPct === 100 ? '#5B8A72' : '#B5602A' }]} />
          </View>
          <Text style={[s.grayText, { marginTop: 6 }]}>{installed} de {items.length} itens instalados</Text>
        </View>

        {/* Stats — budget editable */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          <TouchableOpacity style={[s.stat, { flex: 1 }]} onPress={() => { setEditingBudget(true); setBudgetInput(String(property.totalBudget || 0)); }}>
            <Text style={s.statLabel}>Orçamento</Text>
            <Text style={s.statVal}>{fmt(property.totalBudget || 0)}</Text>
            <Text style={{ fontSize: 10, color: '#B5602A', marginTop: 2 }}>✎ editar</Text>
          </TouchableOpacity>
          <View style={[s.stat, { flex: 1 }]}>
            <Text style={s.statLabel}>Estimado</Text>
            <Text style={[s.statVal, { color: '#B5602A' }]}>{fmt(totalEstimated)}</Text>
            {remaining !== 0 && (
              <Text style={{ fontSize: 10, color: remaining >= 0 ? '#5B8A72' : '#DC2626', marginTop: 2 }}>
                {remaining >= 0 ? `${fmt(remaining)} disponível` : `${fmt(Math.abs(remaining))} acima`}
              </Text>
            )}
          </View>
          <View style={[s.stat, { flex: 1 }]}>
            <Text style={s.statLabel}>Pago</Text>
            <Text style={[s.statVal, { color: '#5B8A72' }]}>{fmt(totalPaid)}</Text>
            {totalEstimated > 0 && (
              <Text style={{ fontSize: 10, color: '#9E9894', marginTop: 2 }}>
                {((totalPaid / totalEstimated) * 100).toFixed(0)}% do estimado
              </Text>
            )}
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
            const roomTotal = roomItems.reduce((acc, i) => acc + i.estimatedPrice, 0);
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
                  <View style={[s.progressFill, { width: `${totalEstimated > 0 ? (c.total / totalEstimated) * 100 : 0}%` as any, backgroundColor: c.color }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Collaborators */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={s.sectionTitle}>Colaboradores ({(property.members ?? []).length})</Text>
            {isOwner && (
              <TouchableOpacity style={s.toggleRow} onPress={handleToggleInvite}>
                <View style={[s.toggle, property.inviteEnabled && s.toggleOn]}>
                  <View style={[s.toggleThumb, property.inviteEnabled && s.toggleThumbOn]} />
                </View>
                <Text style={{ fontSize: 12, color: '#6B6460' }}>Convite</Text>
              </TouchableOpacity>
            )}
          </View>

          {(property.members ?? []).map((member: PropertyMember) => {
            const initials = (member.displayName || member.email || '?').slice(0, 2).toUpperCase();
            const isOwnerMember = member.role === 'owner';
            return (
              <View key={member.uid} style={s.memberRow}>
                <View style={s.memberAvatar}>
                  <Text style={s.memberAvatarText}>{initials}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#1A1714' }} numberOfLines={1}>
                    {member.displayName || member.email}
                  </Text>
                  {member.displayName && (
                    <Text style={{ fontSize: 12, color: '#9E9894' }} numberOfLines={1}>{member.email}</Text>
                  )}
                </View>
                <View style={[s.roleBadge, { backgroundColor: isOwnerMember ? '#FEF9C3' : '#DBEAFE' }]}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: isOwnerMember ? '#854D0E' : '#1D4ED8' }}>
                    {isOwnerMember ? 'Dono' : 'Editor'}
                  </Text>
                </View>
                {isOwner && member.uid !== user?.uid && (
                  <TouchableOpacity onPress={() => removeMember(member.uid)} style={s.removeBtn}>
                    <Text style={{ color: '#9E9894', fontSize: 13 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {isOwner && property.inviteEnabled && (
            <TouchableOpacity style={s.inviteRow} onPress={handleShareInvite}>
              <Text style={{ fontSize: 13, color: '#6B6460', flex: 1 }}>meuap.app/join/{id}</Text>
              <Text style={{ fontSize: 13, color: '#B5602A', fontWeight: '600' }}>🔗 Compartilhar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Navigation */}
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

        <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
          <Text style={s.deleteBtnText}>Excluir imóvel</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Budget edit modal */}
      <Modal visible={editingBudget} transparent animationType="fade">
        <View style={s.modalBackdrop}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Editar orçamento</Text>
            <TextInput
              style={s.modalInput}
              value={budgetInput} onChangeText={setBudgetInput}
              keyboardType="numeric" autoFocus
              placeholder="0" placeholderTextColor="#9E9894"
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#F0EDE9' }]} onPress={() => setEditingBudget(false)}>
                <Text style={[s.btnText, { color: '#1A1714' }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={saveBudget}>
                <Text style={s.btnText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  title: { fontSize: 24, fontWeight: '700', color: '#1A1714', letterSpacing: -0.4, marginBottom: 2 },
  sub: { fontSize: 13, color: '#9E9894' },
  address: { fontSize: 13, color: '#6B6460' },
  inlineInput: {
    backgroundColor: '#F7F5F2', borderWidth: 1.5, borderColor: '#B5602A',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    fontSize: 15, color: '#1A1714',
  },
  inlineSave: { backgroundColor: '#B5602A', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 },
  inlineSaveText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  inlineCancel: { backgroundColor: '#F0EDE9', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6 },
  inlineCancelText: { color: '#6B6460', fontWeight: '600', fontSize: 13 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toggle: { width: 34, height: 18, borderRadius: 9, backgroundColor: '#D1CBC5', position: 'relative' },
  toggleOn: { backgroundColor: '#B5602A' },
  toggleThumb: { position: 'absolute', top: 2, left: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' },
  toggleThumbOn: { left: 18 },
  toggleLabel: { fontSize: 13, color: '#6B6460' },
  shareBtn: { borderWidth: 1, borderColor: '#E4E0DB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  shareBtnText: { fontSize: 13, color: '#B5602A', fontWeight: '500' },
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
  stat: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E4E0DB' },
  statLabel: { fontSize: 11, color: '#9E9894', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  statVal: { fontSize: 16, fontWeight: '700', color: '#1A1714' },
  alert: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 14 },
  alertText: { fontSize: 13, color: '#991B1B', fontWeight: '500' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1A1714', marginBottom: 12 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 12, fontWeight: '500' },
  statusCount: { fontSize: 12, fontWeight: '700' },
  roomIcon: { width: 32, height: 32, borderRadius: 7, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  link: { fontSize: 13, color: '#B5602A', fontWeight: '500' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0EDE9' },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0EDE9', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  memberAvatarText: { fontSize: 13, fontWeight: '700', color: '#6B6460' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  removeBtn: { borderWidth: 1, borderColor: '#E4E0DB', borderRadius: 6, padding: 6 },
  inviteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14,
    backgroundColor: '#F7F5F2', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#E4E0DB',
  },
  navGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  navBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E4E0DB' },
  navBtnText: { fontSize: 12, fontWeight: '600', color: '#1A1714', textAlign: 'center' },
  deleteBtn: { borderWidth: 1.5, borderColor: '#FECACA', borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: '#FFF5F5' },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A1714', marginBottom: 12 },
  modalInput: { backgroundColor: '#F7F5F2', borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 10, padding: 12, fontSize: 16, color: '#1A1714' },
  btn: { backgroundColor: '#B5602A', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});

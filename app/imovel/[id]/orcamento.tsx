import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  watchProperty, watchRooms, watchItems,
  createItem, updateItem, deleteItem, updateProperty,
} from '@/lib/firebase/firestore';
import {
  Property, FirestoreRoom, FirestoreItem, PriceLink,
  CATEGORIES, STATUS_CONFIG, PRIORITY_CONFIG,
  ItemCategory, ItemStatus, ItemPriority,
} from '@/lib/types';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

function itemMonth(item: FirestoreItem): string | null {
  const ts = (item.updatedAt as { toDate?: () => Date })?.toDate?.();
  if (!ts) return null;
  return `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-');
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${months[parseInt(m) - 1]}/${y}`;
}

export default function OrcamentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<FirestoreRoom[]>([]);
  const [items, setItems] = useState<FirestoreItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<ItemStatus | 'all'>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<FirestoreItem | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  useEffect(() => {
    const u1 = watchProperty(id, p => { setProperty(p); setLoading(false); });
    const u2 = watchRooms(id, setRooms);
    const u3 = watchItems(id, setItems);
    return () => { u1(); u2(); u3(); };
  }, [id]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    items.forEach(i => { const m = itemMonth(i); if (m) months.add(m); });
    return Array.from(months).sort().reverse();
  }, [items]);

  const totalEstimated = items.reduce((s, i) => s + i.estimatedPrice, 0);
  const totalPaid = items.reduce((s, i) => s + (i.paidPrice ?? 0), 0);
  const remaining = (property?.totalBudget ?? 0) - totalEstimated;
  const budgetPct = property?.totalBudget ? Math.min(100, (totalEstimated / property.totalBudget) * 100) : 0;

  const periodItems = selectedPeriod === 'all'
    ? items
    : items.filter(i => itemMonth(i) === selectedPeriod);

  const filtered = periodItems.filter(i =>
    (selectedCategory === 'all' || i.category === selectedCategory) &&
    (selectedStatus === 'all' || i.status === selectedStatus)
  ).sort((a, b) => b.estimatedPrice - a.estimatedPrice);

  const filteredTotal = filtered.reduce((s, i) => s + i.estimatedPrice, 0);

  const categoryTotals = (Object.keys(CATEGORIES) as ItemCategory[]).map(cat => ({
    cat, ...CATEGORIES[cat],
    total: items.filter(i => i.category === cat).reduce((s, i) => s + i.estimatedPrice, 0),
    count: items.filter(i => i.category === cat).length,
  })).filter(c => c.count > 0).sort((a, b) => b.total - a.total);

  // Smart alerts
  const alerts: string[] = [];
  if (totalEstimated > 0) {
    rooms.forEach(room => {
      const roomTotal = items.filter(i => i.roomId === room.id).reduce((s, i) => s + i.estimatedPrice, 0);
      const share = roomTotal / totalEstimated;
      if (share > 0.4 && roomTotal > 500) {
        alerts.push(`${room.icon} ${room.name} concentra ${Math.round(share * 100)}% do total (${fmt(roomTotal)})`);
      }
    });
    categoryTotals.forEach(c => {
      const share = c.total / totalEstimated;
      if (share > 0.5 && c.total > 500) {
        alerts.push(`"${c.label}" representa ${Math.round(share * 100)}% do total (${fmt(c.total)})`);
      }
    });
    const highPending = items.filter(i => i.priority === 'alta' && (i.status === 'quero_comprar' || i.status === 'pesquisando')).length;
    if (highPending > 0) {
      alerts.push(`${highPending} item${highPending > 1 ? 'ns' : ''} de alta prioridade ainda não ${highPending > 1 ? 'comprados' : 'comprado'}`);
    }
  }

  const saveBudget = async () => {
    const v = parseFloat(budgetInput.replace(',', '.'));
    if (!isNaN(v) && v >= 0) await updateProperty(id, { totalBudget: v });
    setEditingBudget(false);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#B5602A" size="large" /></View>;

  const filterLabel =
    selectedPeriod !== 'all' ? fmtMonth(selectedPeriod) :
    selectedCategory !== 'all' ? CATEGORIES[selectedCategory].label :
    selectedStatus !== 'all' ? STATUS_CONFIG[selectedStatus as ItemStatus].label :
    'Todos os itens';

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F5F2' }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← {property?.name ?? 'Voltar'}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.title}>Orçamento</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setAddingItem(true)}>
            <Text style={s.addBtnText}>+ Item</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.sub}>{items.length} itens · planejado vs. realizado</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* Financial stats */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {/* Orçamento */}
          <TouchableOpacity
            style={[s.statCard, { flex: 1 }]}
            onPress={() => { setEditingBudget(true); setBudgetInput(String(property?.totalBudget ?? 0)); }}
          >
            <Text style={s.statLabel}>Orçamento</Text>
            <Text style={[s.statVal, { color: '#1A1714' }]}>{fmt(property?.totalBudget ?? 0)}</Text>
            <Text style={{ fontSize: 10, color: '#B5602A', marginTop: 2 }}>✎ editar</Text>
          </TouchableOpacity>
          {/* Estimado */}
          <View style={[s.statCard, { flex: 1 }]}>
            <Text style={s.statLabel}>Estimado</Text>
            <Text style={[s.statVal, { color: '#B5602A' }]}>{fmt(totalEstimated)}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {/* Pago */}
          <View style={[s.statCard, { flex: 1 }]}>
            <Text style={s.statLabel}>Pago</Text>
            <Text style={[s.statVal, { color: '#5B8A72' }]}>{fmt(totalPaid)}</Text>
          </View>
          {/* Disponível / Excedido */}
          <View style={[s.statCard, { flex: 1 }]}>
            <Text style={s.statLabel}>{remaining >= 0 ? 'Disponível' : 'Excedido'}</Text>
            <Text style={[s.statVal, { color: remaining >= 0 ? '#5B8A72' : '#DC2626' }]}>{fmt(Math.abs(remaining))}</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={[s.card, { marginBottom: 10 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={s.grayText}>Comprometido do orçamento</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1A1714' }}>
              {property?.totalBudget ? `${budgetPct.toFixed(0)}%` : '—'}
            </Text>
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${budgetPct}%` as any, backgroundColor: remaining < 0 ? '#DC2626' : '#B5602A' }]} />
          </View>
          {remaining < 0 && (
            <Text style={{ marginTop: 8, fontSize: 13, color: '#DC2626', fontWeight: '500' }}>
              ⚠️ Orçamento excedido em {fmt(Math.abs(remaining))}
            </Text>
          )}
        </View>

        {/* Smart alerts */}
        {alerts.map((alert, i) => (
          <View key={i} style={s.alertCard}>
            <Text style={{ fontSize: 13 }}>💡 {alert}</Text>
          </View>
        ))}

        {/* Category breakdown */}
        {categoryTotals.length > 0 && (
          <View style={[s.card, { marginBottom: 14 }]}>
            <Text style={s.sectionTitle}>Por categoria</Text>
            {categoryTotals.map(c => (
              <TouchableOpacity
                key={c.cat}
                style={[s.catRow, selectedCategory === c.cat && { backgroundColor: '#F0EDE9' }]}
                onPress={() => setSelectedCategory(selectedCategory === c.cat ? 'all' : c.cat)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c.color }} />
                  <Text style={[{ fontSize: 13, color: '#1A1714' }, selectedCategory === c.cat && { fontWeight: '700' }]}>{c.label}</Text>
                  <Text style={{ fontSize: 11, color: '#9E9894' }}>({c.count})</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4, minWidth: 80 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: c.color }}>{fmt(c.total)}</Text>
                  <View style={s.progressBar}>
                    <View style={[s.progressFill, { width: `${totalEstimated > 0 ? (c.total / totalEstimated) * 100 : 0}%` as any, backgroundColor: c.color }]} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Status filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[s.filterChip, selectedStatus === 'all' && selectedCategory === 'all' && selectedPeriod === 'all' && s.filterChipActive]}
              onPress={() => { setSelectedStatus('all'); setSelectedCategory('all'); setSelectedPeriod('all'); }}
            >
              <Text style={[s.filterChipText, selectedStatus === 'all' && selectedCategory === 'all' && selectedPeriod === 'all' && s.filterChipTextActive]}>
                Todos ({items.length})
              </Text>
            </TouchableOpacity>
            {(Object.keys(STATUS_CONFIG) as ItemStatus[]).map(st => {
              const cfg = STATUS_CONFIG[st];
              const count = items.filter(i => i.status === st).length;
              if (count === 0) return null;
              return (
                <TouchableOpacity
                  key={st}
                  style={[s.filterChip, selectedStatus === st && { borderColor: cfg.dot, backgroundColor: cfg.bg }]}
                  onPress={() => { setSelectedStatus(selectedStatus === st ? 'all' : st); setSelectedCategory('all'); }}
                >
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: cfg.dot }} />
                  <Text style={[s.filterChipText, selectedStatus === st && { color: cfg.color, fontWeight: '600' }]}>
                    {cfg.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
            {availableMonths.map(m => (
              <TouchableOpacity
                key={m}
                style={[s.filterChip, selectedPeriod === m && s.filterChipActive]}
                onPress={() => { setSelectedPeriod(selectedPeriod === m ? 'all' : m); setSelectedCategory('all'); setSelectedStatus('all'); }}
              >
                <Text style={[s.filterChipText, selectedPeriod === m && s.filterChipTextActive]}>{fmtMonth(m)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Items list */}
        <View style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={s.sectionTitle}>
              {filterLabel}{' '}
              <Text style={{ fontWeight: '400', color: '#9E9894' }}>({filtered.length})</Text>
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#B5602A' }}>{fmt(filteredTotal)}</Text>
          </View>

          {filtered.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#9E9894', paddingVertical: 24, fontSize: 14 }}>
              Nenhum item nesta seleção.
            </Text>
          ) : filtered.map(item => {
            const room = rooms.find(r => r.id === item.roomId);
            const status = STATUS_CONFIG[item.status];
            const priority = PRIORITY_CONFIG[item.priority];
            const cat = CATEGORIES[item.category];
            return (
              <View key={item.id} style={s.itemRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#1A1714' }} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ fontSize: 11, color: '#9E9894', marginTop: 2 }} numberOfLines={1}>
                    {room?.icon} {room?.name} · {cat.label}{item.store ? ` · ${item.store}` : ''}
                  </Text>
                  {item.notes ? <Text style={{ fontSize: 11, color: '#6B6460', marginTop: 2, fontStyle: 'italic' }} numberOfLines={1}>{item.notes}</Text> : null}
                  {item.priceLinks?.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                      {item.priceLinks.map((l, i) => {
                        const isLowest = l.price === Math.min(...item.priceLinks.map(p => p.price));
                        return (
                          <TouchableOpacity
                            key={i}
                            onPress={() => Linking.openURL(l.url).catch(() => {})}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F7F5F2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, borderWidth: 1, borderColor: '#E4E0DB' }}
                          >
                            {isLowest && <Text style={{ fontSize: 10, color: '#5B8A72', fontWeight: '700' }}>↓</Text>}
                            <Text style={{ fontSize: 11, color: '#B5602A' }}>
                              {l.label} · {l.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : item.productUrl ? (
                    <TouchableOpacity onPress={() => Linking.openURL(item.productUrl!).catch(() => {})} style={{ marginTop: 4 }}>
                      <Text style={{ fontSize: 11, color: '#B5602A', textDecorationLine: 'underline' }}>🔗 Ver produto</Text>
                    </TouchableOpacity>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
                    <View style={[s.badge, { backgroundColor: status.bg }]}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: status.dot }} />
                      <Text style={[s.badgeText, { color: status.color }]}>{status.label}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: priority.color + '15' }]}>
                      <Text style={[s.badgeText, { color: priority.color, fontWeight: '600' }]}>{priority.label}</Text>
                    </View>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1714' }}>{fmt(item.estimatedPrice)}</Text>
                  {item.paidPrice != null && (
                    <Text style={{ fontSize: 11, color: '#5B8A72' }}>pago: {fmt(item.paidPrice)}</Text>
                  )}
                  <TouchableOpacity onPress={() => setEditingItem(item)}>
                    <Text style={{ color: '#B5602A', fontSize: 14 }}>✎</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Budget edit modal */}
      <Modal visible={editingBudget} transparent animationType="fade">
        <View style={s.modalBackdrop}>
          <View style={[s.modal, { padding: 24 }]}>
            <Text style={s.modalTitle}>Editar orçamento</Text>
            <TextInput
              style={s.input}
              value={budgetInput}
              onChangeText={setBudgetInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#9E9894"
              autoFocus
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

      {/* Add Item Modal */}
      {addingItem && user && (
        <ItemFormModal
          rooms={rooms}
          propertyId={id}
          userId={user.uid}
          onSave={async data => { await createItem(data); setAddingItem(false); }}
          onClose={() => setAddingItem(false)}
        />
      )}

      {/* Edit Item Modal */}
      {editingItem && user && (
        <ItemFormModal
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

function ItemFormModal({ rooms, propertyId, userId, item, onSave, onDelete, onClose }: {
  rooms: FirestoreRoom[];
  propertyId: string;
  userId: string;
  item?: FirestoreItem;
  onSave: (data: any) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const defaultRoom = rooms[0];
  const [name, setName] = useState(item?.name ?? '');
  const [roomId, setRoomId] = useState(item?.roomId ?? defaultRoom?.id ?? '');
  const [category, setCategory] = useState<ItemCategory>(item?.category ?? 'moveis');
  const [status, setStatus] = useState<ItemStatus>(item?.status ?? 'quero_comprar');
  const [priority, setPriority] = useState<ItemPriority>(item?.priority ?? 'media');
  const [estimatedPrice, setEstimatedPrice] = useState(String(item?.estimatedPrice ?? ''));
  const [paidPrice, setPaidPrice] = useState(String(item?.paidPrice ?? ''));
  const [store, setStore] = useState(item?.store ?? '');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [notes, setNotes] = useState(item?.notes ?? '');
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
      name: name.trim(), description: '', category, status, priority,
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

  const CATS = Object.entries(CATEGORIES) as [ItemCategory, { label: string; color: string }][];
  const STATUSES = Object.entries(STATUS_CONFIG) as [ItemStatus, { label: string; color: string; bg: string; dot: string }][];
  const PRIOS = Object.entries(PRIORITY_CONFIG) as [ItemPriority, { label: string; color: string }][];

  return (
    <Modal visible transparent animationType="slide">
      <View style={s.modalBackdrop}>
        <View style={[s.modal, { maxHeight: '90%' }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={s.modalTitle}>{item ? 'Editar item' : 'Novo item'}</Text>

            <Text style={s.label}>Nome *</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ex: Sofá, Geladeira..." placeholderTextColor="#9E9894" />

            {rooms.length > 0 && (
              <>
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
              </>
            )}

            <Text style={s.label}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {CATS.map(([key, val]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.chipBtn, category === key && { borderColor: val.color, backgroundColor: val.color + '15' }]}
                  onPress={() => setCategory(key)}
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
                  onPress={() => setStatus(key)}
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
                  onPress={() => setPriority(key)}
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
              placeholder="Detalhes adicionais..." placeholderTextColor="#9E9894" multiline
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
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#E4E0DB',
  },
  statCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#E4E0DB',
  },
  statLabel: { fontSize: 11, color: '#9E9894', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statVal: { fontSize: 18, fontWeight: '700' },
  progressBar: { height: 6, backgroundColor: '#F0EDE9', borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: '#B5602A' },
  alertCard: {
    backgroundColor: '#FEF9C3', borderWidth: 1, borderColor: '#FDE047',
    borderRadius: 10, padding: 12, marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1A1714', marginBottom: 12 },
  grayText: { fontSize: 13, color: '#9E9894' },
  catRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderRadius: 8, paddingHorizontal: 6, marginBottom: 6,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F7F5F2',
  },
  filterChipActive: { borderColor: '#B5602A', backgroundColor: '#FDF3EC' },
  filterChipText: { fontSize: 13, color: '#6B6460' },
  filterChipTextActive: { color: '#B5602A', fontWeight: '600' },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0EDE9', gap: 10,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  badgeText: { fontSize: 11, fontWeight: '500' },
  btn: { backgroundColor: '#B5602A', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1714', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#6B6460', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#F7F5F2', borderWidth: 1.5, borderColor: '#E4E0DB',
    borderRadius: 10, padding: 12, fontSize: 14, color: '#1A1714', marginBottom: 4,
  },
  chipBtn: {
    borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5, marginRight: 6,
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F7F5F2',
  },
  chipText: { fontSize: 12, color: '#6B6460' },
});

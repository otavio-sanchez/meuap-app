import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, Linking } from 'react-native';
import { FirestoreItem, ItemStatus, STATUS_CONFIG, STATUS_ORDER, PRIORITY_CONFIG, CATEGORIES } from '@/lib/types';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

interface Props {
  item: FirestoreItem;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: ItemStatus) => void;
}

export function ItemRow({ item, onEdit, onDelete, onStatusChange }: Props) {
  const status = STATUS_CONFIG[item.status];
  const priority = PRIORITY_CONFIG[item.priority];
  const nextStatus = STATUS_ORDER[(STATUS_ORDER.indexOf(item.status) + 1) % STATUS_ORDER.length];
  const isInstalled = item.status === 'instalado';
  const bestPriceLink = item.priceLinks?.length > 0
    ? item.priceLinks.reduce((best, pl) => pl.price < best.price ? pl : best)
    : null;

  return (
    <View style={s.row}>
      <TouchableOpacity
        style={[s.checkbox, { borderColor: status.dot, backgroundColor: (item.status === 'comprado' || isInstalled) ? status.dot : 'transparent' }]}
        onPress={() => onStatusChange(nextStatus)}
      >
        {(item.status === 'comprado' || isInstalled) && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
      </TouchableOpacity>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.name, isInstalled && { textDecorationLine: 'line-through', color: '#9E9894' }]} numberOfLines={1}>
          {item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
        </Text>
        <Text style={s.meta} numberOfLines={1}>
          {CATEGORIES[item.category].label}{item.store ? ` · ${item.store}` : ''}
        </Text>
        {item.notes ? <Text style={s.notes} numberOfLines={1}>{item.notes}</Text> : null}

        {/* Images thumbnail strip */}
        {item.images?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
            {item.images.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={s.thumb} />
            ))}
          </ScrollView>
        )}

        {/* Price links */}
        {item.priceLinks?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
            {item.priceLinks.map((pl, idx) => (
              <TouchableOpacity
                key={idx}
                style={[s.priceLink, bestPriceLink === pl && s.priceLinkBest]}
                onPress={() => Linking.openURL(pl.url).catch(() => {})}
              >
                {bestPriceLink === pl && <Text style={s.priceLinkBestTag}>↓</Text>}
                <Text style={[s.priceLinkText, bestPriceLink === pl && { color: '#166534' }]}>
                  {pl.label || `Opção ${idx + 1}`} · {fmt(pl.price)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Product URL (when no price links) */}
        {(!item.priceLinks || item.priceLinks.length === 0) && item.productUrl && (
          <TouchableOpacity onPress={() => Linking.openURL(item.productUrl!).catch(() => {})} style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 11, color: '#B5602A', textDecorationLine: 'underline' }}>🔗 Ver produto</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <View style={[s.badge, { backgroundColor: status.bg }]}>
          <Text style={[s.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
        <View style={[s.priorityBadge, { backgroundColor: priority.color + '15' }]}>
          <Text style={[s.priorityText, { color: priority.color }]}>{priority.label}</Text>
        </View>
        {item.estimatedPrice > 0 && <Text style={s.price}>{fmt(item.estimatedPrice)}</Text>}
        {item.paidPrice != null && <Text style={{ fontSize: 10, color: '#5B8A72' }}>pago: {fmt(item.paidPrice)}</Text>}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity onPress={onEdit}><Text style={{ color: '#B5602A', fontSize: 14 }}>✎</Text></TouchableOpacity>
          <TouchableOpacity onPress={onDelete}><Text style={{ color: '#DC2626', fontSize: 14 }}>🗑</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0EDE9' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
  name: { fontSize: 14, fontWeight: '500', color: '#1A1714' },
  meta: { fontSize: 11, color: '#9E9894', marginTop: 2 },
  notes: { fontSize: 11, color: '#6B6460', marginTop: 2, fontStyle: 'italic' },
  thumb: { width: 44, height: 44, borderRadius: 6, marginRight: 6, backgroundColor: '#F0EDE9' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '500' },
  priorityBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  priorityText: { fontSize: 10, fontWeight: '600' },
  price: { fontSize: 13, fontWeight: '700', color: '#1A1714' },
  priceLink: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: '#E4E0DB', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, backgroundColor: '#F7F5F2' },
  priceLinkBest: { borderColor: '#5B8A72', backgroundColor: '#DCFCE7' },
  priceLinkBestTag: { fontSize: 10, color: '#166534', fontWeight: '700' },
  priceLinkText: { fontSize: 11, color: '#6B6460' },
});

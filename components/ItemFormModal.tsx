import { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FirestoreItem, FirestoreRoom, PriceLink, ItemStatus, ItemPriority, ItemCategory,
  STATUS_CONFIG, STATUS_ORDER, PRIORITY_CONFIG, CATEGORIES } from '@/lib/types';
import { uploadImage } from '@/lib/firebase/storage';

interface Props {
  rooms: FirestoreRoom[];
  defaultRoomId: string;
  propertyId: string;
  userId: string;
  item?: FirestoreItem;
  onSave: (data: Omit<FirestoreItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export function ItemFormModal({ rooms, defaultRoomId, propertyId, userId, item, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(item?.name ?? '');
  const [roomId, setRoomId] = useState(item?.roomId ?? defaultRoomId);
  const [category, setCategory] = useState<ItemCategory>(item?.category ?? 'moveis');
  const [status, setStatus] = useState<ItemStatus>(item?.status ?? 'quero_comprar');
  const [priority, setPriority] = useState<ItemPriority>(item?.priority ?? 'media');
  const [estimatedPrice, setEstimatedPrice] = useState(String(item?.estimatedPrice ?? ''));
  const [paidPrice, setPaidPrice] = useState(String(item?.paidPrice ?? ''));
  const [store, setStore] = useState(item?.store ?? '');
  const [productUrl, setProductUrl] = useState(item?.productUrl ?? '');
  const [priceLinks, setPriceLinks] = useState<PriceLink[]>(item?.priceLinks ?? []);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkPrice, setNewLinkPrice] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [images, setImages] = useState<string[]>(item?.images ?? []);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const pickImage = async () => {
    const { status: permStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permStatus !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para adicionar fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    setUploadingImage(true);
    try {
      const path = `items/${propertyId}/${userId}/${Date.now()}.jpg`;
      const url = await uploadImage(path, uri);
      setImages(prev => [...prev, url]);
    } catch {
      Alert.alert('Erro', 'Não foi possível fazer upload da imagem.');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const addPriceLink = () => {
    const price = parseFloat(newLinkPrice.replace(',', '.'));
    if (!newLinkUrl.trim() || isNaN(price)) return;
    const label = newLinkLabel.trim() || (() => {
      try { return new URL(newLinkUrl.startsWith('http') ? newLinkUrl : `https://${newLinkUrl}`).hostname.replace(/^www\./, ''); }
      catch { return newLinkUrl; }
    })();
    const updated = [...priceLinks, { url: newLinkUrl.trim(), price, label }];
    setPriceLinks(updated);
    setEstimatedPrice(String(Math.round(updated.reduce((s, l) => s + l.price, 0) / updated.length)));
    setNewLinkUrl(''); setNewLinkPrice(''); setNewLinkLabel('');
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Atenção', 'O nome é obrigatório.'); return; }
    setSaving(true);
    await onSave({
      roomId, propertyId, userId, name: name.trim(), description: '',
      category, status, priority,
      estimatedPrice: parseFloat(estimatedPrice) || 0,
      paidPrice: paidPrice ? parseFloat(paidPrice) : null,
      quantity: parseInt(quantity) || 1,
      store: store.trim() || null,
      productUrl: productUrl.trim() || null,
      priceLinks,
      images,
      notes: notes.trim(),
    });
    setSaving(false);
  };

  return (
    <Modal visible transparent animationType="slide">
      <View style={s.backdrop}>
        <View style={[s.sheet, { maxHeight: '93%' }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={s.title}>{item ? 'Editar item' : 'Novo item'}</Text>

            <Text style={s.label}>Nome *</Text>
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Ex: Sofá..." placeholderTextColor="#9E9894" autoFocus />

            <Text style={s.label}>Cômodo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {rooms.map(r => (
                <TouchableOpacity key={r.id} style={[s.chip, roomId === r.id && { borderColor: r.color, backgroundColor: r.color + '15' }]} onPress={() => setRoomId(r.id)}>
                  <Text style={{ fontSize: 14 }}>{r.icon}</Text>
                  <Text style={[s.chipText, roomId === r.id && { color: r.color, fontWeight: '600' }]}>{r.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.label}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {(Object.entries(CATEGORIES) as [ItemCategory, any][]).map(([key, val]) => (
                <TouchableOpacity key={key} style={[s.chip, category === key && { borderColor: val.color, backgroundColor: val.color + '15' }]} onPress={() => setCategory(key)}>
                  <Text style={[s.chipText, category === key && { color: val.color, fontWeight: '600' }]}>{val.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.label}>Status</Text>
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

            <Text style={s.label}>Prioridade</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
              {(Object.entries(PRIORITY_CONFIG) as [ItemPriority, any][]).map(([key, val]) => (
                <TouchableOpacity key={key} style={[s.chip, priority === key && { borderColor: val.color, backgroundColor: val.color + '15' }]} onPress={() => setPriority(key)}>
                  <Text style={[s.chipText, priority === key && { color: val.color, fontWeight: '600' }]}>{val.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Estimado (R$)</Text>
                <TextInput style={s.input} value={estimatedPrice} onChangeText={setEstimatedPrice} keyboardType="numeric" placeholder="0" placeholderTextColor="#9E9894" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Pago (R$)</Text>
                <TextInput style={s.input} value={paidPrice} onChangeText={setPaidPrice} keyboardType="numeric" placeholder="0" placeholderTextColor="#9E9894" />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Qtd</Text>
                <TextInput style={s.input} value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="1" placeholderTextColor="#9E9894" />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={s.label}>Loja</Text>
                <TextInput style={s.input} value={store} onChangeText={setStore} placeholder="Ex: Tok&Stok" placeholderTextColor="#9E9894" />
              </View>
            </View>

            <Text style={s.label}>Link do produto</Text>
            <TextInput style={s.input} value={productUrl} onChangeText={setProductUrl} placeholder="https://..." placeholderTextColor="#9E9894" autoCapitalize="none" keyboardType="url" />

            {/* Price links */}
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
              <TextInput style={[s.input, { marginBottom: 6 }]} value={newLinkUrl} onChangeText={setNewLinkUrl} placeholder="URL da loja" placeholderTextColor="#9E9894" autoCapitalize="none" keyboardType="url" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} value={newLinkLabel} onChangeText={setNewLinkLabel} placeholder="Loja (opcional)" placeholderTextColor="#9E9894" />
                <TextInput style={[s.input, { flex: 1, marginBottom: 0 }]} value={newLinkPrice} onChangeText={setNewLinkPrice} placeholder="Preço" placeholderTextColor="#9E9894" keyboardType="numeric" />
              </View>
              <TouchableOpacity
                style={[s.btn, { marginTop: 8, paddingVertical: 10, backgroundColor: newLinkUrl.trim() && newLinkPrice ? '#B5602A' : '#E4E0DB' }]}
                onPress={addPriceLink} disabled={!newLinkUrl.trim() || !newLinkPrice}
              >
                <Text style={[s.btnText, { fontSize: 13 }]}>+ Adicionar link</Text>
              </TouchableOpacity>
            </View>

            {/* Images */}
            <Text style={s.label}>Fotos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {images.map((uri, idx) => (
                <View key={idx} style={{ position: 'relative', marginRight: 8 }}>
                  <Image source={{ uri }} style={s.imgThumb} />
                  <TouchableOpacity
                    style={s.imgRemove}
                    onPress={() => removeImage(idx)}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={s.imgAdd} onPress={pickImage} disabled={uploadingImage}>
                {uploadingImage
                  ? <ActivityIndicator color="#B5602A" size="small" />
                  : <Text style={{ fontSize: 24, color: '#B5602A' }}>+</Text>
                }
              </TouchableOpacity>
            </ScrollView>

            <Text style={s.label}>Observações</Text>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1714', marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '600', color: '#6B6460', marginBottom: 5, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F7F5F2', borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 10, padding: 12, fontSize: 14, color: '#1A1714', marginBottom: 4 },
  chip: { borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F7F5F2' },
  chipText: { fontSize: 12, color: '#6B6460' },
  btn: { backgroundColor: '#B5602A', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  imgThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#F0EDE9' },
  imgRemove: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
    width: 18, height: 18, justifyContent: 'center', alignItems: 'center',
  },
  imgAdd: {
    width: 72, height: 72, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E4E0DB', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F5F2',
  },
});

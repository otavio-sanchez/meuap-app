import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { createProperty, createRoom } from '@/lib/firebase/firestore';
import { PROPERTY_TYPES, PropertyType, ROOM_TYPES } from '@/lib/types';

const PRESETS = [
  { label: 'Studio',   counts: { sala: 1, cozinha: 1, banheiro: 1 } },
  { label: '1 quarto', counts: { sala: 1, quarto: 1, cozinha: 1, banheiro: 1 } },
  { label: '2 quartos',counts: { sala: 1, quarto: 2, cozinha: 1, banheiro: 1 } },
  { label: '3 quartos',counts: { sala: 1, quarto: 3, cozinha: 1, banheiro: 2 } },
] as const;

export default function NovoImovelScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<'imovel' | 'comodos'>('imovel');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');

  // Step 1
  const [name, setName] = useState('');
  const [type, setType] = useState<PropertyType>('apartamento');
  const [area, setArea] = useState('');
  const [budget, setBudget] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);

  // Step 2
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({
    sala: 1, quarto: 1, cozinha: 1, banheiro: 1,
  });
  const [customRooms, setCustomRooms] = useState<{ id: string; name: string }[]>([]);
  const [customInput, setCustomInput] = useState('');

  const totalRooms = Object.values(roomCounts).reduce((s, n) => s + n, 0) + customRooms.length;

  const setCount = (roomType: string, delta: number) => {
    setRoomCounts(prev => ({ ...prev, [roomType]: Math.max(0, (prev[roomType] ?? 0) + delta) }));
  };

  const applyPreset = (counts: Record<string, number>) => {
    const reset = Object.fromEntries(ROOM_TYPES.map(r => [r.type, 0]));
    setRoomCounts({ ...reset, ...counts });
  };

  const addCustomRoom = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    setCustomRooms(prev => [...prev, { id: Math.random().toString(36), name: trimmed }]);
    setCustomInput('');
  };

  const handleNext = () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'O nome do imóvel é obrigatório.');
      return;
    }
    setStep('comodos');
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setLoadingMsg('Criando imóvel...');
      const propertyId = await createProperty({
        userId: user.uid,
        name: name.trim(),
        type,
        area: parseFloat(area) || 0,
        roomCount: totalRooms,
        description,
        address,
        isPublic: false,
        publicSlug: null,
        coverImage: null,
        totalBudget: parseFloat(budget) || 0,
        memberUids: [user.uid],
        members: [{ uid: user.uid, email: user.email ?? '', displayName: user.displayName, role: 'owner' }],
        inviteEnabled: false,
        floorPlanUrl: null,
        floorPlanAnnotations: [],
      });

      setLoadingMsg(`Criando ${totalRooms} cômodo${totalRooms !== 1 ? 's' : ''}...`);
      let order = 0;
      const roomPromises: Promise<string>[] = [];

      for (const [roomType, count] of Object.entries(roomCounts)) {
        if (count <= 0) continue;
        const rt = ROOM_TYPES.find(r => r.type === roomType);
        if (!rt) continue;
        for (let i = 0; i < count; i++) {
          roomPromises.push(createRoom({
            propertyId,
            userId: user.uid,
            name: count > 1 ? `${rt.name} ${i + 1}` : rt.name,
            type: rt.type,
            icon: rt.icon,
            color: rt.color,
            order: order++,
            notes: '',
          }));
        }
      }
      for (const cr of customRooms) {
        roomPromises.push(createRoom({
          propertyId,
          userId: user.uid,
          name: cr.name,
          type: 'personalizado',
          icon: '✏️',
          color: '#8B5CF6',
          order: order++,
          notes: '',
        }));
      }
      await Promise.all(roomPromises);

      router.replace(`/imovel/${propertyId}`);
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Não foi possível criar o imóvel. Tente novamente.');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const pct = step === 'imovel' ? 50 : 100;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => step === 'comodos' ? setStep('imovel') : router.back()}>
          <Text style={s.back}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={s.title}>Novo imóvel</Text>
        <Text style={s.sub}>Passo {step === 'imovel' ? '1' : '2'} de 2 — {step === 'imovel' ? 'Informações' : 'Cômodos'}</Text>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${pct}%` as any }]} />
        </View>
      </View>

      {step === 'imovel' ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>Nome do imóvel *</Text>
          <TextInput
            style={s.input} value={name} onChangeText={setName}
            placeholder="Ex: Meu Apê, Casa da Família..."
            placeholderTextColor="#9E9894"
          />

          <Text style={s.label}>Tipo de imóvel</Text>
          <TouchableOpacity style={[s.input, s.picker]} onPress={() => setShowTypePicker(!showTypePicker)}>
            <Text style={{ color: '#1A1714', fontSize: 15 }}>{PROPERTY_TYPES[type]}</Text>
            <Text style={{ color: '#9E9894' }}>▾</Text>
          </TouchableOpacity>
          {showTypePicker && (
            <View style={s.pickerMenu}>
              {(Object.keys(PROPERTY_TYPES) as PropertyType[]).map(t => (
                <TouchableOpacity key={t} style={s.pickerItem} onPress={() => { setType(t); setShowTypePicker(false); }}>
                  <Text style={[s.pickerItemText, t === type && { color: '#B5602A', fontWeight: '600' }]}>
                    {PROPERTY_TYPES[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Área (m²)</Text>
              <TextInput
                style={s.input} value={area} onChangeText={setArea}
                placeholder="Ex: 65" placeholderTextColor="#9E9894"
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Orçamento (R$)</Text>
              <TextInput
                style={s.input} value={budget} onChangeText={setBudget}
                placeholder="Ex: 30000" placeholderTextColor="#9E9894"
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={s.label}>Endereço (opcional)</Text>
          <TextInput
            style={s.input} value={address} onChangeText={setAddress}
            placeholder="Ex: Rua das Flores, 123 - SP"
            placeholderTextColor="#9E9894"
          />

          <Text style={s.label}>Descrição (opcional)</Text>
          <TextInput
            style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
            value={description} onChangeText={setDescription}
            placeholder="Andar, localização, observações..."
            placeholderTextColor="#9E9894"
            multiline
          />

          <TouchableOpacity style={s.btn} onPress={handleNext}>
            <Text style={s.btnText}>Próximo: escolher cômodos →</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body}>
          {/* Presets */}
          <Text style={s.sectionLabel}>Configuração rápida</Text>
          <View style={s.presets}>
            {PRESETS.map(p => (
              <TouchableOpacity key={p.label} style={s.presetBtn} onPress={() => applyPreset(p.counts)}>
                <Text style={s.presetText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.presetBtn} onPress={() => applyPreset({})}>
              <Text style={s.presetText}>Limpar</Text>
            </TouchableOpacity>
          </View>

          {/* Room types */}
          <Text style={s.sectionLabel}>Ambientes</Text>
          {ROOM_TYPES.filter(r => r.type !== 'personalizado').map(room => {
            const count = roomCounts[room.type] ?? 0;
            const active = count > 0;
            return (
              <TouchableOpacity
                key={room.type}
                style={[s.roomRow, active && { borderColor: room.color + '60', backgroundColor: room.color + '10' }]}
                onPress={() => !active && setCount(room.type, 1)}
                activeOpacity={active ? 1 : 0.7}
              >
                <Text style={s.roomIcon}>{room.icon}</Text>
                <Text style={[s.roomName, active && { color: room.color, fontWeight: '600' }]}>{room.name}</Text>
                {active ? (
                  <View style={s.counter}>
                    <TouchableOpacity style={[s.counterBtn, { borderColor: room.color + '60', backgroundColor: room.color + '15' }]}
                      onPress={() => setCount(room.type, -1)}>
                      <Text style={[s.counterBtnText, { color: room.color }]}>{count === 1 ? '✕' : '−'}</Text>
                    </TouchableOpacity>
                    <View style={[s.counterNum, { borderColor: room.color + '60' }]}>
                      <Text style={[s.counterNumText, { color: room.color }]}>{count}</Text>
                    </View>
                    <TouchableOpacity style={[s.counterBtn, { borderColor: room.color + '60', backgroundColor: room.color + '15' }]}
                      onPress={() => setCount(room.type, 1)}>
                      <Text style={[s.counterBtnText, { color: room.color }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={s.roomHint}>Toque para adicionar</Text>
                )}
              </TouchableOpacity>
            );
          })}

          {/* Custom rooms */}
          <Text style={[s.sectionLabel, { marginTop: 16 }]}>Cômodo personalizado</Text>
          {customRooms.map(cr => (
            <View key={cr.id} style={[s.roomRow, { borderColor: '#8B5CF660', backgroundColor: '#8B5CF610' }]}>
              <Text style={s.roomIcon}>✏️</Text>
              <Text style={[s.roomName, { color: '#8B5CF6', fontWeight: '600', flex: 1 }]}>{cr.name}</Text>
              <TouchableOpacity onPress={() => setCustomRooms(prev => prev.filter(r => r.id !== cr.id))}>
                <Text style={{ color: '#9E9894', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <TextInput
              style={[s.input, { flex: 1, marginBottom: 0 }]}
              value={customInput} onChangeText={setCustomInput}
              placeholder="Ex: Despensa, Closet..."
              placeholderTextColor="#9E9894"
              onSubmitEditing={addCustomRoom}
              returnKeyType="done"
            />
            <TouchableOpacity style={s.addCustomBtn} onPress={addCustomRoom}>
              <Text style={s.addCustomText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.btn, (loading || totalRooms === 0) && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={loading || totalRooms === 0}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>
                  {totalRooms === 0 ? 'Selecione ao menos 1 cômodo' : `Criar com ${totalRooms} cômodo${totalRooms !== 1 ? 's' : ''} →`}
                </Text>
            }
          </TouchableOpacity>
          {loadingMsg ? <Text style={s.loadingMsg}>{loadingMsg}</Text> : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#E4E0DB',
  },
  back: { fontSize: 14, color: '#6B6460', marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: '#1A1714', letterSpacing: -0.5 },
  sub: { fontSize: 13, color: '#9E9894', marginTop: 2, marginBottom: 10 },
  progressBar: { height: 4, backgroundColor: '#E4E0DB', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#B5602A', borderRadius: 2 },
  body: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#6B6460', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E4E0DB',
    borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1714', marginBottom: 4,
  },
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerMenu: {
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E4E0DB',
    borderRadius: 12, marginBottom: 4, overflow: 'hidden',
  },
  pickerItem: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F0EDE9' },
  pickerItemText: { fontSize: 15, color: '#1A1714' },
  btn: {
    backgroundColor: '#B5602A', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 20,
    shadowColor: '#B5602A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  loadingMsg: { textAlign: 'center', marginTop: 8, fontSize: 13, color: '#6B6460' },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: '#9E9894',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 4,
  },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  presetBtn: {
    borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#F7F5F2',
  },
  presetText: { fontSize: 13, fontWeight: '500', color: '#1A1714' },
  roomRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 10, borderWidth: 2, borderColor: '#E4E0DB',
    backgroundColor: 'transparent', marginBottom: 8,
  },
  roomIcon: { fontSize: 20 },
  roomName: { flex: 1, fontSize: 14, color: '#1A1714' },
  roomHint: { fontSize: 12, color: '#9E9894' },
  counter: { flexDirection: 'row', alignItems: 'center' },
  counterBtn: {
    width: 30, height: 30, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center',
    borderRadius: 6,
  },
  counterBtnText: { fontSize: 16, fontWeight: '600' },
  counterNum: {
    width: 36, height: 30, borderTopWidth: 1.5, borderBottomWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff',
  },
  counterNumText: { fontSize: 15, fontWeight: '700' },
  addCustomBtn: {
    backgroundColor: '#F7F5F2', borderWidth: 1.5, borderColor: '#E4E0DB',
    borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center',
  },
  addCustomText: { fontSize: 14, fontWeight: '500', color: '#1A1714' },
});

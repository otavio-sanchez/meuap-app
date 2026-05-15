import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image, Modal, GestureResponderEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { watchProperty, watchRooms, updateProperty } from '@/lib/firebase/firestore';
import { uploadImage } from '@/lib/firebase/storage';
import { Property, FirestoreRoom, FloorPlanAnnotation } from '@/lib/types';
import * as ImagePicker from 'expo-image-picker';

export default function PlantaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<FirestoreRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [selectRoomModal, setSelectRoomModal] = useState(false);
  const [removingAnnotation, setRemovingAnnotation] = useState<FloorPlanAnnotation | null>(null);

  useEffect(() => {
    const u1 = watchProperty(id, p => { setProperty(p); setLoading(false); });
    const u2 = watchRooms(id, setRooms);
    return () => { u1(); u2(); };
  }, [id]);

  const handlePickFloorPlan = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para adicionar a planta.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const path = `floor-plans/${id}/${user!.uid}/${Date.now()}.jpg`;
      const url = await uploadImage(path, result.assets[0].uri);
      await updateProperty(id, { floorPlanUrl: url, floorPlanAnnotations: [] });
    } catch {
      Alert.alert('Erro', 'Não foi possível fazer upload da planta.');
    } finally {
      setUploading(false);
    }
  };

  const handleImageTap = (evt: GestureResponderEvent) => {
    if (!property?.floorPlanUrl || imageLayout.width === 0) return;
    const { locationX, locationY } = evt.nativeEvent;
    const x = locationX / imageLayout.width;
    const y = locationY / imageLayout.height;
    setPendingPin({ x, y });
    setSelectRoomModal(true);
  };

  const handlePlacePin = async (room: FirestoreRoom) => {
    if (!pendingPin || !property) return;
    const existing = (property.floorPlanAnnotations ?? []).filter(a => a.roomId !== room.id);
    const annotations: FloorPlanAnnotation[] = [...existing, { roomId: room.id, x: pendingPin.x, y: pendingPin.y }];
    await updateProperty(id, { floorPlanAnnotations: annotations });
    setPendingPin(null);
    setSelectRoomModal(false);
  };

  const handleRemoveAnnotation = async (ann: FloorPlanAnnotation) => {
    if (!property) return;
    const annotations = (property.floorPlanAnnotations ?? []).filter(a => a.roomId !== ann.roomId);
    await updateProperty(id, { floorPlanAnnotations: annotations });
    setRemovingAnnotation(null);
  };

  const handleRemovePlan = () => {
    Alert.alert('Remover planta', 'Tem certeza? As anotações também serão removidas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover', style: 'destructive',
        onPress: () => updateProperty(id, { floorPlanUrl: null, floorPlanAnnotations: [] }),
      },
    ]);
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#B5602A" size="large" /></View>;

  const annotations = property?.floorPlanAnnotations ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F5F2' }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← {property?.name ?? 'Voltar'}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.title}>Planta Baixa</Text>
          {property?.floorPlanUrl && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={s.headerBtn} onPress={handlePickFloorPlan} disabled={uploading}>
                <Text style={s.headerBtnText}>Trocar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.headerBtn, { borderColor: '#FECACA' }]} onPress={handleRemovePlan}>
                <Text style={[s.headerBtnText, { color: '#DC2626' }]}>Remover</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {property?.floorPlanUrl && (
          <Text style={s.hint}>Toque na planta para marcar um cômodo · Toque num pin para remover</Text>
        )}
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {!property?.floorPlanUrl ? (
          /* Empty state */
          <View style={s.emptyCard}>
            <Text style={{ fontSize: 56, marginBottom: 16 }}>🏗️</Text>
            <Text style={s.emptyTitle}>Nenhuma planta adicionada</Text>
            <Text style={s.emptySub}>Adicione uma foto da planta baixa para marcar onde ficam os cômodos.</Text>
            <TouchableOpacity style={s.uploadBtn} onPress={handlePickFloorPlan} disabled={uploading}>
              {uploading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.uploadBtnText}>📎 Adicionar planta</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Floor Plan Image with pins */}
            <View style={s.planCard}>
              <View style={{ position: 'relative' }}>
                <Image
                  source={{ uri: property.floorPlanUrl }}
                  style={s.planImage}
                  resizeMode="contain"
                  onLayout={e => {
                    const { width, height } = e.nativeEvent.layout;
                    setImageLayout({ width, height });
                  }}
                />
                {/* Transparent touch layer */}
                <View
                  style={StyleSheet.absoluteFillObject}
                  onStartShouldSetResponder={() => true}
                  onResponderRelease={handleImageTap}
                >
                  {/* Annotation pins */}
                  {imageLayout.width > 0 && annotations.map(ann => {
                    const room = rooms.find(r => r.id === ann.roomId);
                    if (!room) return null;
                    return (
                      <TouchableOpacity
                        key={ann.roomId}
                        style={[s.pin, {
                          left: ann.x * imageLayout.width - 18,
                          top: ann.y * imageLayout.height - 36,
                        }]}
                        onPress={() => setRemovingAnnotation(ann)}
                      >
                        <View style={[s.pinBubble, { backgroundColor: room.color }]}>
                          <Text style={{ fontSize: 13 }}>{room.icon}</Text>
                        </View>
                        <View style={[s.pinTail, { borderTopColor: room.color }]} />
                        <Text style={[s.pinLabel, { color: room.color }]} numberOfLines={1}>{room.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Legend */}
            {rooms.length > 0 && (
              <View style={s.card}>
                <Text style={s.sectionTitle}>Cômodos marcados</Text>
                {rooms.map(room => {
                  const ann = annotations.find(a => a.roomId === room.id);
                  return (
                    <View key={room.id} style={s.legendRow}>
                      <View style={[s.legendIcon, { backgroundColor: room.color + '18', borderColor: room.color + '40' }]}>
                        <Text style={{ fontSize: 15 }}>{room.icon}</Text>
                      </View>
                      <Text style={s.legendName}>{room.name}</Text>
                      {ann
                        ? <Text style={s.legendMarked}>✓ Marcado</Text>
                        : <Text style={s.legendUnmarked}>Toque na planta</Text>
                      }
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Select room modal */}
      <Modal visible={selectRoomModal} transparent animationType="slide">
        <View style={s.modalBackdrop}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Qual cômodo?</Text>
            <Text style={s.modalSub}>Selecione o cômodo a marcar nesta posição.</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {rooms.map(room => {
                const alreadyPlaced = annotations.some(a => a.roomId === room.id);
                return (
                  <TouchableOpacity
                    key={room.id}
                    style={[s.roomOption, alreadyPlaced && { opacity: 0.5 }]}
                    onPress={() => handlePlacePin(room)}
                  >
                    <View style={[s.roomOptionIcon, { backgroundColor: room.color + '18', borderColor: room.color + '40' }]}>
                      <Text style={{ fontSize: 18 }}>{room.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.roomOptionName}>{room.name}</Text>
                      {alreadyPlaced && <Text style={s.roomOptionSub}>Já marcado — vai reposicionar</Text>}
                    </View>
                    <Text style={{ color: room.color, fontSize: 16 }}>→</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={[s.btn, { marginTop: 12, backgroundColor: '#F0EDE9' }]} onPress={() => { setPendingPin(null); setSelectRoomModal(false); }}>
              <Text style={[s.btnText, { color: '#1A1714' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Remove annotation confirm */}
      <Modal visible={!!removingAnnotation} transparent animationType="fade">
        <View style={s.modalBackdrop}>
          <View style={s.modal}>
            {removingAnnotation && (() => {
              const room = rooms.find(r => r.id === removingAnnotation.roomId);
              return (
                <>
                  <Text style={s.modalTitle}>Remover pin?</Text>
                  <Text style={s.modalSub}>Remover a marcação de "{room?.name ?? ''}" da planta?</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#F0EDE9' }]} onPress={() => setRemovingAnnotation(null)}>
                      <Text style={[s.btnText, { color: '#1A1714' }]}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#DC2626' }]} onPress={() => handleRemoveAnnotation(removingAnnotation)}>
                      <Text style={s.btnText}>Remover</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F5F2' },
  header: {
    backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#E4E0DB',
  },
  back: { fontSize: 14, color: '#6B6460', marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '700', color: '#1A1714', letterSpacing: -0.4 },
  hint: { fontSize: 12, color: '#9E9894', marginTop: 6 },
  headerBtn: { borderWidth: 1, borderColor: '#E4E0DB', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  headerBtnText: { fontSize: 13, color: '#B5602A', fontWeight: '500' },
  body: { padding: 16, paddingBottom: 48 },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center',
    borderWidth: 1, borderColor: '#E4E0DB',
    shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1A1714', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#9E9894', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  uploadBtn: { backgroundColor: '#B5602A', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  planCard: {
    backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: 14,
    borderWidth: 1, borderColor: '#E4E0DB',
  },
  planImage: { width: '100%', height: 320 },
  pin: { position: 'absolute', alignItems: 'center', width: 36 },
  pinBubble: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  pinTail: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  pinLabel: { fontSize: 9, fontWeight: '700', marginTop: 2, textAlign: 'center', maxWidth: 60 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: '#E4E0DB',
  },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#1A1714', marginBottom: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0EDE9' },
  legendIcon: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  legendName: { flex: 1, fontSize: 14, fontWeight: '500', color: '#1A1714' },
  legendMarked: { fontSize: 12, color: '#5B8A72', fontWeight: '600' },
  legendUnmarked: { fontSize: 12, color: '#C9C4BF', fontStyle: 'italic' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1A1714', marginBottom: 6 },
  modalSub: { fontSize: 13, color: '#9E9894', marginBottom: 4 },
  roomOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0EDE9' },
  roomOptionIcon: { width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  roomOptionName: { fontSize: 15, fontWeight: '500', color: '#1A1714' },
  roomOptionSub: { fontSize: 12, color: '#B5602A', marginTop: 2 },
  btn: { backgroundColor: '#B5602A', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});

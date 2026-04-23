import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  watchProperty, watchTasks,
  createTask, updateTask, deleteTask, seedDefaultTasks,
} from '@/lib/firebase/firestore';
import { Property, MoveTask, MoveTaskCategory, MOVE_TASK_CATEGORIES } from '@/lib/types';

export default function MudancaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [tasks, setTasks] = useState<MoveTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<MoveTaskCategory | 'all'>('all');
  const [addingTask, setAddingTask] = useState(false);
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState<MoveTaskCategory>('outros');
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const u1 = watchProperty(id, p => setProperty(p));
    const u2 = watchTasks(id, t => { setTasks(t); setLoading(false); });
    return () => { u1(); u2(); };
  }, [id]);

  const done = tasks.filter(t => t.done).length;
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  const handleAdd = async () => {
    if (!user || !newText.trim()) return;
    await createTask({ propertyId: id, userId: user.uid, text: newText.trim(), category: newCategory, done: false });
    setNewText('');
    setAddingTask(false);
  };

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    await seedDefaultTasks(id, user.uid);
    setSeeding(false);
  };

  const categories = Object.keys(MOVE_TASK_CATEGORIES) as MoveTaskCategory[];
  const visible = tasks.filter(t => filterCat === 'all' || t.category === filterCat);

  if (loading) return <View style={s.center}><ActivityIndicator color="#B5602A" size="large" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F5F2' }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.back}>← {property?.name ?? 'Voltar'}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.title}>Checklist de Mudança</Text>
          <TouchableOpacity style={s.addBtn} onPress={() => setAddingTask(true)}>
            <Text style={s.addBtnText}>+ Tarefa</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.sub}>{done}/{tasks.length} tarefas concluídas</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        {/* Progress bar */}
        {tasks.length > 0 && (
          <View style={[s.card, { marginBottom: 14 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={s.grayText}>Progresso geral</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: pct === 100 ? '#5B8A72' : '#1A1714' }}>
                {pct}%{pct === 100 ? ' 🎉' : ''}
              </Text>
            </View>
            <View style={s.progressBar}>
              <View style={[s.progressFill, {
                width: `${pct}%` as any,
                backgroundColor: pct === 100 ? '#5B8A72' : '#B5602A',
              }]} />
            </View>
          </View>
        )}

        {/* Empty state */}
        {tasks.length === 0 ? (
          <View style={[s.card, { alignItems: 'center', padding: 40 }]}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🚛</Text>
            <Text style={{ color: '#6B6460', textAlign: 'center', marginBottom: 20, fontSize: 14 }}>
              Nenhuma tarefa ainda. Use a lista padrão ou crie a sua.
            </Text>
            <TouchableOpacity style={s.btn} onPress={handleSeed} disabled={seeding}>
              <Text style={s.btnText}>{seeding ? 'Adicionando...' : '✨ Usar checklist padrão'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: '#F0EDE9', marginTop: 10 }]} onPress={() => setAddingTask(true)}>
              <Text style={[s.btnText, { color: '#1A1714' }]}>+ Criar tarefa</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Category filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[s.filterChip, filterCat === 'all' && s.filterChipActive]}
                  onPress={() => setFilterCat('all')}
                >
                  <Text style={[s.filterChipText, filterCat === 'all' && s.filterChipTextActive]}>
                    Todas ({tasks.length})
                  </Text>
                </TouchableOpacity>
                {categories.filter(cat => tasks.some(t => t.category === cat)).map(cat => {
                  const cfg = MOVE_TASK_CATEGORIES[cat];
                  const count = tasks.filter(t => t.category === cat).length;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[s.filterChip, filterCat === cat && { borderColor: cfg.color, backgroundColor: cfg.color + '15' }]}
                      onPress={() => setFilterCat(filterCat === cat ? 'all' : cat)}
                    >
                      <Text style={{ fontSize: 14 }}>{cfg.icon}</Text>
                      <Text style={[s.filterChipText, filterCat === cat && { color: cfg.color, fontWeight: '600' }]}>
                        {cfg.label} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Tasks grouped by category */}
            {categories.filter(cat => filterCat === 'all' || filterCat === cat).map(cat => {
              const catTasks = visible.filter(t => t.category === cat);
              if (catTasks.length === 0) return null;
              const cfg = MOVE_TASK_CATEGORIES[cat];
              const catDone = catTasks.filter(t => t.done).length;
              return (
                <View key={cat} style={[s.card, { marginBottom: 12 }]}>
                  {/* Category header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Text style={{ fontSize: 18 }}>{cfg.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1A1714' }}>{cfg.label}</Text>
                      <Text style={{ fontSize: 12, color: '#9E9894' }}>{catDone}/{catTasks.length} concluídas</Text>
                    </View>
                    <View style={{ width: 72 }}>
                      <View style={s.progressBar}>
                        <View style={[s.progressFill, {
                          width: `${catTasks.length > 0 ? (catDone / catTasks.length) * 100 : 0}%` as any,
                          backgroundColor: cfg.color,
                        }]} />
                      </View>
                    </View>
                  </View>

                  {/* Tasks */}
                  {catTasks.map((task, idx) => (
                    <View key={task.id} style={[s.taskRow, idx < catTasks.length - 1 && s.taskRowBorder]}>
                      <TouchableOpacity
                        style={[s.checkbox, {
                          backgroundColor: task.done ? cfg.color : 'transparent',
                          borderColor: task.done ? cfg.color : '#D1CBC5',
                        }]}
                        onPress={() => updateTask(task.id, { done: !task.done })}
                      >
                        {task.done && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>}
                      </TouchableOpacity>
                      <Text style={[s.taskText, task.done && s.taskTextDone]} numberOfLines={2}>
                        {task.text}
                      </Text>
                      <TouchableOpacity onPress={() => deleteTask(task.id)} style={{ padding: 4 }}>
                        <Text style={{ color: '#C9C4BF', fontSize: 14 }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })}

            <TouchableOpacity style={[s.btn, { backgroundColor: '#F0EDE9' }]} onPress={() => setAddingTask(true)}>
              <Text style={[s.btnText, { color: '#1A1714' }]}>+ Nova tarefa</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Add task modal */}
      <Modal visible={addingTask} transparent animationType="slide">
        <View style={s.modalBackdrop}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Nova tarefa</Text>

            <Text style={s.label}>Tarefa</Text>
            <TextInput
              style={s.input}
              value={newText}
              onChangeText={setNewText}
              placeholder="Ex: Contratar transportadora"
              placeholderTextColor="#9E9894"
              autoFocus
            />

            <Text style={s.label}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {(Object.keys(MOVE_TASK_CATEGORIES) as MoveTaskCategory[]).map(cat => {
                const cfg = MOVE_TASK_CATEGORIES[cat];
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[s.chipBtn, newCategory === cat && { borderColor: cfg.color, backgroundColor: cfg.color + '15' }]}
                    onPress={() => setNewCategory(cat)}
                  >
                    <Text style={{ fontSize: 14 }}>{cfg.icon}</Text>
                    <Text style={[s.chipText, newCategory === cat && { color: cfg.color, fontWeight: '600' }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: '#F0EDE9' }]} onPress={() => { setAddingTask(false); setNewText(''); }}>
                <Text style={[s.btnText, { color: '#1A1714' }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={handleAdd} disabled={!newText.trim()}>
                <Text style={s.btnText}>Adicionar</Text>
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
  title: { fontSize: 22, fontWeight: '700', color: '#1A1714', letterSpacing: -0.4 },
  sub: { fontSize: 13, color: '#9E9894', marginTop: 2 },
  addBtn: { backgroundColor: '#B5602A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#E4E0DB',
  },
  progressBar: { height: 6, backgroundColor: '#F0EDE9', borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },
  grayText: { fontSize: 13, color: '#9E9894' },
  btn: { backgroundColor: '#B5602A', borderRadius: 12, padding: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: '#E4E0DB', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F7F5F2',
  },
  filterChipActive: { borderColor: '#B5602A', backgroundColor: '#FDF3EC' },
  filterChipText: { fontSize: 13, color: '#6B6460' },
  filterChipTextActive: { color: '#B5602A', fontWeight: '600' },
  taskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
  },
  taskRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0EDE9' },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  taskText: { flex: 1, fontSize: 14, color: '#1A1714' },
  taskTextDone: { textDecorationLine: 'line-through', color: '#9E9894' },
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

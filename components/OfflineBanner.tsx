import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '@/lib/useNetworkStatus';

export function OfflineBanner() {
  const connected = useNetworkStatus();

  if (connected !== false) return null;

  return (
    <View style={s.banner}>
      <Text style={s.text}>📡 Sem conexão — alterações serão sincronizadas quando voltar online.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: '#1A1714',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  text: {
    color: '#F7F5F2',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});

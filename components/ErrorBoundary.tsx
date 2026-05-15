import { Component, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { reportError } from '@/lib/errorReporting';

interface Props {
  children: ReactNode;
  userId?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    reportError(error, 'ErrorBoundary', this.props.userId);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={s.container}>
        <Text style={s.icon}>⚠️</Text>
        <Text style={s.title}>Algo deu errado</Text>
        <Text style={s.message} numberOfLines={3}>{this.state.message}</Text>
        <TouchableOpacity style={s.btn} onPress={this.handleRetry}>
          <Text style={s.btnText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F5F2', padding: 32 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1714', marginBottom: 10 },
  message: { fontSize: 13, color: '#9E9894', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  btn: { backgroundColor: '#B5602A', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

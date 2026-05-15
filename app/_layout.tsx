import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function AppStack() {
  const { user } = useAuth();
  return (
    <ErrorBoundary userId={user?.uid}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="novo-imovel" />
        <Stack.Screen name="imovel" />
        <Stack.Screen name="p" />
        <Stack.Screen name="join" />
      </Stack>
    </ErrorBoundary>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppStack />
    </AuthProvider>
  );
}

import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export function LinearGradientLikeCard({ children }: { children: ReactNode }) {
  return (
    <View style={styles.shadowWrap}>
      <View style={styles.card}>{children}</View>
      <View style={styles.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: { position: 'relative', marginVertical: 20 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: '#bae6fd',
    shadowColor: '#0369a1',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  accent: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 74,
    height: 74,
    borderRadius: 999,
    backgroundColor: '#38bdf8',
    opacity: 0.2,
  },
});

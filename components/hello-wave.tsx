import Animated from 'react-native-reanimated';
import { Hand } from 'lucide-react-native';

export function HelloWave() {
  return (
    <Animated.View
      style={{
        width: 32,
        height: 32,
        marginTop: -6,
        animationName: {
          '50%': { transform: [{ rotate: '25deg' }] },
        },
        animationIterationCount: 4,
        animationDuration: '300ms',
      }}>
      <Hand size={28} color="#0369a1" />
    </Animated.View>
  );
}

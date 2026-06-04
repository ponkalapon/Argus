import { Pressable, Text, View } from 'react-native';
import { Bot, ChevronDown, Folder, Menu } from 'lucide-react-native';

import { colors } from '../../styles/theme';

type Props = {
  modelLabel: string;
  onOpenDrawer: () => void;
  onOpenModelPicker: () => void;
  onOpenWorkspaceFiles: () => void | Promise<void>;
  styles: any;
};

export const WorkspaceHeader = ({ modelLabel, onOpenDrawer, onOpenModelPicker, onOpenWorkspaceFiles, styles }: Props) => (
  <View style={styles.header}>
    <Pressable
      accessibilityRole="button"
      onPress={onOpenDrawer}
      style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
    >
      <Menu size={20} color={colors.text} />
    </Pressable>

    <Pressable
      style={({ pressed }) => [styles.modelPill, pressed && styles.pressed]}
      onPress={onOpenModelPicker}
      accessibilityRole="button"
    >
      <Bot size={14} color="#a78bfa" style={{ marginRight: 4 }} />
      <Text style={styles.modelPillLabel} numberOfLines={1}>
        {modelLabel}
      </Text>
      <ChevronDown size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
    </Pressable>

    <View style={styles.headerRight}>
      <Pressable
        accessibilityRole="button"
        onPress={onOpenWorkspaceFiles}
        style={({ pressed }) => [styles.headerBtn, pressed && styles.pressed]}
      >
        <Folder size={20} color={colors.text} />
      </Pressable>
    </View>
  </View>
);

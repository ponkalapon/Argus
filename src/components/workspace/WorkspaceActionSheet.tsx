import { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Camera, Folder, Globe, Image, Paperclip, Users } from 'lucide-react-native';
import type { LucideProps } from 'lucide-react-native';

import { GestureBottomSheet, BOTTOM_SHEET_HEIGHT } from '../GestureBottomSheet';
import { colors, spacing } from '../../styles/theme';

type ActionItem = {
  label: string;
  icon: ComponentType<LucideProps>;
  onPress: () => void | Promise<void>;
  iconColor?: string;
};

type Props = {
  handleAttachDocument: () => void | Promise<void>;
  handleCamera: () => void | Promise<void>;
  handleContactsSearch: () => void | Promise<void>;
  handleOpenFiles: () => void | Promise<void>;
  handlePhotoLibrary: () => void | Promise<void>;
  internetEnabled: boolean;
  onToggleInternet: () => void;
  setShowAttachMenu: (value: boolean) => void;
  showAttachMenu: boolean;
  styles: any;
};

export const WorkspaceActionSheet = ({
  handleAttachDocument,
  handleCamera,
  handleContactsSearch,
  handleOpenFiles,
  handlePhotoLibrary,
  internetEnabled,
  onToggleInternet,
  setShowAttachMenu,
  showAttachMenu,
  styles,
}: Props) => {
  const items: ActionItem[] = [
    { label: 'Камера', icon: Camera, onPress: handleCamera },
    { label: 'Фото', icon: Image, onPress: handlePhotoLibrary },
    { label: 'Файлы', icon: Paperclip, onPress: handleAttachDocument },
    { label: 'Файл. менеджер', icon: Folder, onPress: handleOpenFiles },
    { label: 'Контакты', icon: Users, onPress: handleContactsSearch },
    { label: internetEnabled ? 'Интернет: вкл' : 'Интернет: выкл', icon: Globe, onPress: onToggleInternet, iconColor: internetEnabled ? '#60a5fa' : colors.textMuted },
  ];

  return (
    <GestureBottomSheet
      visible={showAttachMenu}
      onClose={() => setShowAttachMenu(false)}
      snapPoints={{ partial: BOTTOM_SHEET_HEIGHT - 260, closed: 3000 }}
      springConfig={{ damping: 28, stiffness: 220 }}
    >
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingTop: spacing.md }}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Pressable
              key={item.label}
              style={({ pressed }) => [styles.attachItem, pressed && styles.attachItemPressed]}
              onPress={() => {
                setShowAttachMenu(false);
                item.onPress();
              }}
            >
              <View style={styles.attachItemIcon}>
                <Icon size={22} color={item.iconColor || colors.textMuted} />
              </View>
              <Text style={styles.attachItemLabel}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </GestureBottomSheet>
  );
};

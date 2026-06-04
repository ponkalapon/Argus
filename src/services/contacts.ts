import * as Contacts from 'expo-contacts';
import { Linking, Alert } from 'react-native';

export type ContactResult = {
  id: string;
  name: string;
  phones: string[];
};

export const searchContacts = async (query: string): Promise<ContactResult[]> => {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') throw new Error('Нет доступа к контактам');

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
    sort: 'firstName',
  });

  if (!data || data.length === 0) return [];

  const q = query.toLowerCase();
  return data
    .filter((c) => {
      const name = (c.name || '').toLowerCase();
      const phones = (c.phoneNumbers || []).map((p) => p.number || '').join(' ');
      return name.includes(q) || phones.includes(q);
    })
    .map((c) => ({
      id: c.id || '',
      name: c.name || 'Без имени',
      phones: (c.phoneNumbers || []).map((p) => p.number || '').filter(Boolean),
    }))
    .slice(0, 10);
};

export const openDialer = (phone: string) => {
  const url = `tel:${encodeURIComponent(phone.replace(/[^+\d]/g, ''))}`;
  Linking.canOpenURL(url).then((ok) => {
    if (ok) Linking.openURL(url);
    else Alert.alert('Ошибка', 'Телефон не поддерживает звонки');
  });
};

export const openSms = (phone: string, body?: string) => {
  const url = `sms:${encodeURIComponent(phone.replace(/[^+\d]/g, ''))}${body ? `?body=${encodeURIComponent(body)}` : ''}`;
  Linking.canOpenURL(url).then((ok) => {
    if (ok) Linking.openURL(url);
    else Alert.alert('Ошибка', 'Не удалось открыть SMS');
  });
};

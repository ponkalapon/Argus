import { Linking, Alert } from 'react-native';

export type ContactResult = {
  id: string;
  name: string;
  phones: string[];
};

export type ContactSafePreview = {
  id: string;
  name: string;
  phoneCount: number;
  maskedPhones: string[];
};

export const normalizePhone = (phone: string) => phone.replace(/[^+\d]/g, '');

const maskPhone = (phone: string) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return 'скрыт';
  const hasPlus = normalized.startsWith('+');
  const digits = normalized.replace(/\D/g, '');
  const tail = digits.slice(-2);
  const hidden = '•'.repeat(Math.max(4, Math.min(digits.length - tail.length, 8)));
  return `${hasPlus ? '+' : ''}${hidden}${tail}`;
};

export const toSafeContactPreview = (contact: ContactResult): ContactSafePreview => ({
  id: contact.id,
  name: contact.name,
  phoneCount: contact.phones.length,
  maskedPhones: contact.phones.map(maskPhone),
});

export const searchContacts = async (query: string): Promise<ContactResult[]> => {
  try {
    const Contacts = require('expo-contacts');
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') throw new Error('Нет доступа к контактам');

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      sort: 'firstName',
    });

    if (!data || data.length === 0) return [];

    const q = query.toLowerCase();
    return data
      .filter((c: any) => {
        const name = (c.name || '').toLowerCase();
        const phones = (c.phoneNumbers || []).map((p: any) => p.number || '').join(' ');
        return !q || name.includes(q) || phones.includes(q);
      })
      .map((c: any) => ({
        id: c.id || '',
        name: c.name || 'Без имени',
        phones: (c.phoneNumbers || []).map((p: any) => p.number || '').filter(Boolean),
      }))
      .filter((c: any) => c.phones.length > 0)
      .slice(0, 10);
  } catch {
    return [];
  }
};

export const openDialer = (phone: string) => {
  const url = `tel:${encodeURIComponent(normalizePhone(phone))}`;
  Linking.canOpenURL(url).then((ok) => {
    if (ok) Linking.openURL(url);
    else Alert.alert('Ошибка', 'Телефон не поддерживает звонки');
  });
};

export const openSms = (phone: string, body?: string) => {
  const url = `sms:${encodeURIComponent(normalizePhone(phone))}${body ? `?body=${encodeURIComponent(body)}` : ''}`;
  Linking.canOpenURL(url).then((ok) => {
    if (ok) Linking.openURL(url);
    else Alert.alert('Ошибка', 'Не удалось открыть SMS');
  });
};

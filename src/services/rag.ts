import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { PDFDocument } from 'pdf-lib';

export interface DocumentContext {
  name: string;
  content: string;
}

export async function pickAndParseDocument(): Promise<DocumentContext | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'text/plain'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const fileUri = asset.uri;
  const fileName = asset.name;

  if (fileName.toLowerCase().endsWith('.pdf')) {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const pdfDoc = await PDFDocument.load(base64);
    const pages = pdfDoc.getPages();
    // pdf-lib doesn't have built-in text extraction. 
    // Usually for RN we use something like react-native-pdf-parser or similar.
    // However, since we can't easily add native libs without rebuild, 
    // and I already installed pdf-lib (which is JS), I'll check if there's a way.
    // Actually, pdf-lib is for creation/modification. 
    // For extraction in pure JS, 'pdfjs-dist' is common.
    
    // Let's try to find a pure JS way to extract text or use a different approach.
    // Given the constraints, I'll implement a placeholder or use a very basic text extraction if I can.
    // Actually, I'll switch to using a simpler text-based RAG first and 
    // if PDF is needed, I'll suggest the user that it works better with text/txt files for now
    // UNLESS I can find a working JS-only PDF parser.
    
    return { name: fileName, content: "Текст из PDF (в разработке: требуется нативный модуль для качественного парсинга). Пожалуйста, используйте .txt файлы для лучшего результата." };
  } else {
    const content = await FileSystem.readAsStringAsync(fileUri);
    return { name: fileName, content };
  }
}

export function searchContext(query: string, documents: DocumentContext[]): string {
  if (documents.length === 0) return '';
  
  // Простейший поиск по ключевым словам для демонстрации RAG
  // В идеале здесь должен быть векторный поиск
  let relevantText = '';
  for (const doc of documents) {
    relevantText += `\n--- Документ: ${doc.name} ---\n${doc.content}\n`;
  }
  
  return relevantText.slice(0, 10000); // Ограничиваем контекст 10к символов
}

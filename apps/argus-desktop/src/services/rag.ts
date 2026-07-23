import * as DocumentPicker from 'expo-document-picker';

export interface DocumentContext {
  name: string;
  content: string;
}

export const PDF_UNSUPPORTED_MESSAGE = 'PDF пока не поддерживается';

const TEXT_DOCUMENT_TYPES = [
  'application/pdf',
  'text/*',
  'application/json',
  'application/javascript',
  'application/typescript',
  'application/xml',
  'application/yaml',
  'application/x-yaml',
  'application/toml',
];

function isPdfDocument(name: string, mimeType?: string | null): boolean {
  return mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
}

export async function pickAndParseDocument(): Promise<DocumentContext | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: TEXT_DOCUMENT_TYPES,
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const fileUri = asset.uri;
  const fileName = asset.name;

  if (isPdfDocument(fileName, asset.mimeType)) {
    throw new Error(PDF_UNSUPPORTED_MESSAGE);
  }

  let content = '';
  if (asset.file) {
    content = await asset.file.text();
  } else {
    const res = await fetch(fileUri);
    content = await res.text();
  }

  return { name: fileName, content };
}

export function searchContext(query: string, documents: DocumentContext[]): string {
  if (documents.length === 0) return '';
  
  let relevantText = '';
  for (const doc of documents) {
    relevantText += `\n--- Документ: ${doc.name} ---\n${doc.content}\n`;
  }
  
  return relevantText.slice(0, 10000);
}

import React, { memo } from 'react';
import { View, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  chart: string;
}

const MermaidChart = memo(({ chart }: Props) => {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            background-color: transparent; 
            margin: 0; 
            display: flex; 
            justify-content: center; 
            align-items: center;
            min-height: 100vh;
          }
          #mermaid-container {
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div id="mermaid-container" class="mermaid">
          ${chart}
        </div>
        <script type="module">
          import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
          mermaid.initialize({ 
            startOnLoad: true, 
            theme: 'dark',
            securityLevel: 'loose',
          });
        </script>
      </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        scalesPageToFit={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color="#a78bfa" />
          </View>
        )}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: 300,
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    marginVertical: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2d2d4e',
  },
  webview: {
    backgroundColor: 'transparent',
  },
  loading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MermaidChart;

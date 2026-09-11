// Root React component
// TODO: implement

import { DocumentProvider } from './context/DocumentContext';
import EditorCanvas from './components/Editor/EditorCanvas';

function App() {
  return (
    <DocumentProvider>
      <EditorCanvas />
    </DocumentProvider>
  );
}

export default App;
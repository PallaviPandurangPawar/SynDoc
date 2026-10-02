// Shares the editor's live state across components: the document structure (AST),
// which block the user is editing, and exactly where their cursor / selection is.
import { createContext, useContext, useMemo, useState } from 'react';

// 1. Create the "box" that will hold shared data
const DocumentContext = createContext();

// 2. This component provides that data to everything inside it
export function DocumentProvider({ children }) {
  // ast = the document's structure (Abstract Syntax Tree)
  const [ast, setAst] = useState(null);

  // activeBlockId = which block (AST node) the user is currently editing
  const [activeBlockId, setActiveBlockId] = useState(null);

  // localCursor = where this user's cursor or selection is:
  // { nodeId, start, end } (start === end means a plain cursor), or null
  const [localCursor, setLocalCursor] = useState(null);

  // The "value" object is what every component will be able to access
  const value = useMemo(
    () => ({ ast, setAst, activeBlockId, setActiveBlockId, localCursor, setLocalCursor }),
    [ast, activeBlockId, localCursor]
  );

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

// 3. A shortcut hook so components don't need to import useContext + DocumentContext every time
export function useDocument() {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocument must be used inside a DocumentProvider');
  }
  return context;
}